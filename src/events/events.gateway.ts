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
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);

    // In a real app, you'd extract the JWT from client.handshake.auth.token 
    // and disconnect them if invalid. For brevity, we allow connections.
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
}
