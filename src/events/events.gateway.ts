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
import { UseFilters } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from '../lib/auth';
import { fromNodeHeaders } from 'better-auth/node';

// Basic driver location payload
interface LocationPayload {
  orderId: string;
  driverProfileId?: string;
  lat: number;
  lng: number;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Allow connections from frontend
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) { }

  // 1. Connection Handling
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
        console.warn(`[Gateway] Unauthorized connection rejected: ${client.id}`);
        client.disconnect();
        return;
      }

      // 4. Attach verified user to socket for tracked event broadcasts
      client.data.user = session.user;
      
      // 5. Always join their persistent, unique user room
      const userRoom = `user_${session.user.id}`;
      client.join(userRoom);
      console.log(`[Gateway] Authenticated client connected & joined room ${userRoom}: ${client.id}`);

    } catch (e) {
      console.error('[Gateway] Connection Error:', e);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // 2. Joining specifically tracked orders (Rooms)
  @SubscribeMessage('join_order_tracking')
  handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    // Both Customers and Drivers join a 'room' for a specific order
    const roomName = `order_${orderId}`;
    client.join(roomName);
    console.log(`Client ${client.id} joined tracking for order: ${orderId}`);
    return { event: 'joined', orderId };
  }

  // 3. Driver emitting live location
  @SubscribeMessage('driver_location_update')
  handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationPayload,
  ) {
    const roomName = `order_${payload.orderId}`;

    // Broadcast this location purely to the specific room (i.e. to the Customer)
    this.server.to(roomName).emit('order_location_update', payload);

    // Persist driver's latest GPS to DB (fire-and-forget for speed)
    if (payload.driverProfileId) {
      this.prisma.driverProfile.update({
        where: { id: payload.driverProfileId },
        data: { currentLat: payload.lat, currentLng: payload.lng },
      }).catch((err) => console.error('Failed to persist driver location:', err));
    }
  }

  // 4. Triggered internally by other REST Services (e.g. OrdersService)
  emitOrderStatusChange(orderId: string, newStatus: string) {
    const roomName = `order_${orderId}`;
    this.server.to(roomName).emit('order_status_update', {
      orderId,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  // 5. Send order offer directly to a specific user (Driver)
  emitOrderOffered(userId: string, payload: any) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('order_offered', payload);
  }
}
