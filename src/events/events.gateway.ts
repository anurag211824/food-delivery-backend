import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, UsePipes } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from '../lib/auth';
import { fromNodeHeaders } from 'better-auth/node';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { LocationUpdateDto } from './dto/location-update.dto';
import { JoinOrderTrackingDto } from './dto/join-order-tracking.dto';
import { WsValidationPipe } from './ws-validation.pipe';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.CUSTOMER_APP_ORIGIN,
      process.env.RESTAURANT_APP_ORIGIN,
      process.env.RIDER_APP_ORIGIN,
      process.env.ADMIN_WEB_APP_ORIGIN,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
    ].filter(Boolean),
  },
})
@UsePipes(new WsValidationPipe())
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  // ─── 1. CONNECTION HANDLING ──────────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      // 1. Extract headers from the incoming Upgrade request
      const headers = fromNodeHeaders(client.handshake.headers as any);

      // 2. Allow fallback to `auth.token` payload (for React Native / mobile apps)
      if (client.handshake.auth?.token) {
        headers.set('authorization', `Bearer ${client.handshake.auth.token}`);
      }

      // 3. Verify Session against Better Auth
      const session = await auth.api.getSession({ headers });

      if (!session) {
        this.logger.warn(`Unauthorized connection rejected: ${client.id}`);
        client.disconnect();
        return;
      }

      // 4. Attach verified user to socket for tracked event broadcasts
      client.data.user = session.user;

      // 5. Always join their persistent, unique user room
      const userRoom = `user_${session.user.id}`;
      client.join(userRoom);
      this.logger.log(`Authenticated client connected & joined room ${userRoom}: ${client.id}`);

      // 6. If user is a RESTAURANT_MANAGER, auto-join them to their restaurant room
      if ((session.user as any).role === 'RESTAURANT_MANAGER') {
        const restaurant = await this.prisma.restaurant.findUnique({
          where: { managerId: session.user.id },
          select: { id: true },
        });
        if (restaurant) {
          const restaurantRoom = `restaurant_${restaurant.id}`;
          client.join(restaurantRoom);
          client.data.restaurantId = restaurant.id;
          this.logger.log(`Restaurant manager ${client.id} auto-joined room ${restaurantRoom}`);
        }
      }

      // 6b. If user is a STORE_MANAGER, auto-join them to their store room
      if ((session.user as any).role === 'STORE_MANAGER') {
        const store = await this.prisma.store.findUnique({
          where: { managerId: session.user.id },
          select: { id: true },
        });
        if (store) {
          const storeRoom = `store_${store.id}`;
          client.join(storeRoom);
          client.data.storeId = store.id;
          this.logger.log(`Store manager ${client.id} auto-joined room ${storeRoom}`);
        }
      }

      // 7. Auto-rejoin active order rooms on reconnect
      //    This handles internet drops, app restarts, and background kills
      await this.rejoinActiveOrderRooms(client, session.user);

    } catch (e) {
      this.logger.error('Connection Error:', e);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── 2. CLIENT ROOM MANAGEMENT ──────────────────────────────────────────

  @SubscribeMessage('join_order_tracking')
  async handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() { orderId }: JoinOrderTrackingDto,
  ) {
    const user = client.data?.user;
    if (!user) {
      return { event: 'error', data: 'Not authenticated' };
    }

    // Security: Verify the user is a participant of this order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { managerId: true } },
        store: { select: { managerId: true } },
        driver: { select: { userId: true } },
      },
    });

    if (!order) {
      return { event: 'error', data: 'Order not found' };
    }

    const isCustomer = order.customerId === user.id;
    const isManager = order.restaurant?.managerId === user.id || order.store?.managerId === user.id;
    const isDriver = order.driver?.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isCustomer && !isManager && !isDriver && !isAdmin) {
      return { event: 'error', data: 'You are not authorized to track this order' };
    }

    const roomName = `order_${orderId}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined tracking for order: ${orderId}`);
    return { event: 'joined', orderId };
  }

  @SubscribeMessage('leave_order_tracking')
  handleLeaveTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() { orderId }: JoinOrderTrackingDto,
  ) {
    const roomName = `order_${orderId}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left tracking for order: ${orderId}`);
    return { event: 'left', orderId };
  }

  // ─── 3. DRIVER LIVE LOCATION ─────────────────────────────────────────────

  @SubscribeMessage('driver_location_update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationUpdateDto,
  ) {
    const user = client.data?.user;
    if (!user) return;

    const isAvailabilityUpdate = payload.orderId.startsWith('availability:');

    if (!isAvailabilityUpdate) {
      // Security check: Only allow the assigned driver to update the order location
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        include: { driver: true }
      });

      if (!order || order.driver?.userId !== user.id) {
        this.logger.warn(`User ${user.id} attempted to spoof location for order ${payload.orderId}`);
        return { event: 'error', data: 'Unauthorized to update location for this order' };
      }

      const roomName = `order_${payload.orderId}`;

      // Broadcast this location to the specific room (customer + restaurant)
      this.server.to(roomName).emit('order_location_update', payload);
    }

    // Update Redis Geo index for fast nearest-driver lookups
    if (user?.id) {
      // 1. Update the coordinate in the geo index
      this.redis.geoadd('driver_locations', payload.lng, payload.lat, user.id)
        .catch((err) => this.logger.error('Failed to update Redis geo index:', err));

      // 2. Refresh a keep-alive key (TTL 10 mins) to track if the driver is still active
      //    This replaces the 'updatedAt' database timestamp for location checks.
      this.redis.setex(`driver_last_seen:${user.id}`, 600, 'active')
        .catch((err) => this.logger.error('Failed to update driver keep-alive:', err));
    }
  }

  // ─── 4. SERVER-SIDE EMITTERS (Called by Services) ────────────────────────

  /** Broadcast order status change to all watchers of an order */
  emitOrderStatusChange(orderId: string, newStatus: string) {
    const roomName = `order_${orderId}`;
    this.logger.log(`[Status Update] Order ${orderId} -> ${newStatus}`);
    this.server.to(roomName).emit('order_status_update', {
      orderId,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  /** Notify a restaurant's live dashboard about a new incoming order */
  emitNewOrderToRestaurant(restaurantId: string, payload: any) {
    const restaurantRoom = `restaurant_${restaurantId}`;
    this.server.to(restaurantRoom).emit('new_order', payload);
    this.logger.log(`Emitted new_order to room ${restaurantRoom}`);
  }

  /** Notify a grocery store's live dashboard about a new incoming order */
  emitNewOrderToStore(storeId: string, payload: any) {
    const storeRoom = `store_${storeId}`;
    this.server.to(storeRoom).emit('new_order', payload);
    this.logger.log(`Emitted new_order to room ${storeRoom}`);
  }

  /** Notify the order room that a driver has been assigned */
  emitDriverAssigned(orderId: string, driverPayload: any) {
    const roomName = `order_${orderId}`;
    this.server.to(roomName).emit('driver_assigned', {
      orderId,
      driver: driverPayload,
      timestamp: new Date().toISOString(),
    });
  }

  /** Send order offer directly to a specific driver's private room */
  emitOrderOffered(userId: string, payload: any) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('order_offered', payload);
  }

  /** Tell a driver's app that the offer has expired (dismiss the popup) */
  emitOrderOfferExpired(userId: string, orderId: string) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('order_offer_expired', {
      orderId,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── 5. ROOM LIFECYCLE HELPERS ──────────────────────────────────────────

  /** Server-side: Force a specific user into an order tracking room */
  joinUserToOrderRoom(userId: string, orderId: string) {
    const userRoom = `user_${userId}`;
    const orderRoom = `order_${orderId}`;

    // Find all sockets in the user's private room and add them to the order room
    const userSockets = this.server.in(userRoom).fetchSockets();
    userSockets.then(sockets => {
      for (const socket of sockets) {
        socket.join(orderRoom);
        this.logger.log(`Auto-joined user ${userId} (socket ${socket.id}) into ${orderRoom}`);
      }
    }).catch(err => this.logger.error(`Failed to auto-join user ${userId} to ${orderRoom}:`, err));
  }

  /**
   * Cleanup: Evict ALL sockets from an order room when the order reaches a terminal state.
   * This prevents stale rooms from accumulating in memory.
   */
  async cleanupOrderRoom(orderId: string) {
    const orderRoom = `order_${orderId}`;
    try {
      const sockets = await this.server.in(orderRoom).fetchSockets();
      for (const socket of sockets) {
        socket.leave(orderRoom);
      }
      this.logger.log(`Cleaned up room ${orderRoom} — evicted ${sockets.length} socket(s)`);
    } catch (err) {
      this.logger.error(`Failed to cleanup room ${orderRoom}:`, err);
    }
  }

  /**
   * On reconnect, automatically rejoin the user to any active order rooms
   * so they immediately resume receiving real-time updates without any frontend action.
   */
  private async rejoinActiveOrderRooms(client: Socket, user: any) {
    const userId = user.id;
    const role = user.role;

    // Terminal statuses — orders in these states don't need tracking rooms
    const activeFilter = { notIn: ['DELIVERED', 'CANCELLED', 'REFUSED'] as any };

    try {
      let orderIds: string[] = [];

      if (role === 'CUSTOMER') {
        // Customer: Rejoin any order they placed that is still active
        const activeOrders = await this.prisma.order.findMany({
          where: { customerId: userId, status: activeFilter },
          select: { id: true },
        });
        orderIds = activeOrders.map(o => o.id);

      } else if (role === 'DELIVERY_PARTNER') {
        // Driver: Rejoin the order they are currently delivering
        const profile = await this.prisma.driverProfile.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (profile) {
          const activeOrders = await this.prisma.order.findMany({
            where: { driverId: profile.id, status: activeFilter },
            select: { id: true },
          });
          orderIds = activeOrders.map(o => o.id);
        }

      } else if (role === 'RESTAURANT_MANAGER') {
        // Manager: Rejoin all active orders for their restaurant
        const restaurant = await this.prisma.restaurant.findUnique({
          where: { managerId: userId },
          select: { id: true },
        });
        if (restaurant) {
          const activeOrders = await this.prisma.order.findMany({
            where: { restaurantId: restaurant.id, status: activeFilter },
            select: { id: true },
          });
          orderIds = activeOrders.map(o => o.id);
        }

      } else if (role === 'STORE_MANAGER') {
        // Store Manager: Rejoin all active orders for their dark store
        const store = await this.prisma.store.findUnique({
          where: { managerId: userId },
          select: { id: true },
        });
        if (store) {
          const activeOrders = await this.prisma.order.findMany({
            where: { storeId: store.id, status: activeFilter },
            select: { id: true },
          });
          orderIds = activeOrders.map(o => o.id);
        }
      }

      // Join the socket into each active order room
      for (const orderId of orderIds) {
        const orderRoom = `order_${orderId}`;
        client.join(orderRoom);
      }

      if (orderIds.length > 0) {
        this.logger.log(`Reconnect: ${role} ${userId} auto-rejoined ${orderIds.length} active order room(s)`);
      }

    } catch (err) {
      // Non-fatal — log and continue. The user can still manually join via the frontend.
      this.logger.error(`Failed to auto-rejoin active orders for ${userId}:`, err);
    }
  }
}
