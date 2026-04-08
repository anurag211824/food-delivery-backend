import { Controller, Post, Body, Patch, Req, UseGuards, ForbiddenException, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { DriverStatus, Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
// import { UpdateDeliveryDto } from './dto/update-delivery.dto';

@ApiTags("Delivery & Logistics")
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.DELIVERY_PARTNER)

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) { }

  @Post()
  @ApiOperation({ summary: "Setup Delivery Profile" })
  @ApiResponse({ status: 201, description: "Profile Created Successfully" })
  async create(@Req() req: AuthenticatedRequest, @Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveryService.createProfile(req.user.id, createDeliveryDto);
  }

  @Get('me')
  @ApiOperation({ summary: "Get My Delivery Profile" })
  @ApiResponse({ status: 200, description: "Returns driver profile and user details" })
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getProfile(req.user.id);
  }

  // toggle status

  @Patch("status")
  @ApiOperation({ summary: "Toggle Online/Offline Status" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        status: { type: 'string', example: "ONLINE", enum: ["ONLINE", "OFFLINE"] },
      },
    }
  })
  async toggleStatus(@Req() req: AuthenticatedRequest, @Body('status') status: string) {
    if (status !== 'ONLINE' && status !== 'OFFLINE') {
      throw new ForbiddenException("Invalid status")
    }

    return this.deliveryService.toggleStatus(req.user.id, status as DriverStatus);
  }

  // Phase 2 APIs

  @Get('available-orders')
  @ApiOperation({ summary: "Get available orders for delivery" })
  @ApiResponse({ status: 200, description: "List of orders ready for pickup" })
  async getAvailableOrders(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getAvailableOrders(req.user.id);
  }

  @Post('orders/:id/accept')
  @ApiOperation({ summary: "Accept a delivery order" })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: "Order successfully assigned to driver" })
  async acceptOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ) {
    return this.deliveryService.acceptOrder(req.user.id, orderId);
  }

  @Post('orders/:id/cancel')
  @ApiOperation({ summary: "Cancel an accepted delivery order before pickup" })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: "Order released and driver returned to ONLINE" })
  async cancelOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ) {
    return this.deliveryService.cancelOrder(req.user.id, orderId);
  }

  @Post('orders/:id/pickup')
  @ApiOperation({ summary: "Confirm pickup of a delivery order" })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: "Order picked up by driver" })
  async pickupOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ) {
    return this.deliveryService.pickupOrder(req.user.id, orderId);
  }

  @Post('orders/:id/complete')
  @ApiOperation({ summary: "Complete a delivery using customer's OTP" })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: "Order successfully delivered" })
  async completeOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Body() completeDto: CompleteOrderDto,
  ) {
    return this.deliveryService.completeOrder(req.user.id, orderId, completeDto.otp);
  }

  @Post('orders/:id/decline')
  @ApiOperation({
    summary: 'Decline a delivery offer',
    description: 'Explicitly decline an offered order. The system will immediately offer it to the next closest driver.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order declined and re-dispatched.' })
  async declineOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ) {
    return this.deliveryService.declineOrder(req.user.id, orderId);
  }

  // ─── MY CURRENT ORDER ──────────────────────────────────────────────────
  @Get('my-current-order')
  @ApiOperation({
    summary: 'Get my active delivery',
    description: 'Returns the single order currently assigned to this driver (status: ON_THE_WAY). Returns null if no active delivery.',
  })
  @ApiResponse({ status: 200, description: 'Active delivery order or null' })
  async getMyCurrentOrder(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getMyCurrentOrder(req.user.id);
  }

  // ─── BACKGROUND LOCATION SYNC ──────────────────────────────────────────
  @Post('sync-location')
  @ApiOperation({
    summary: 'Sync driver location via REST loop',
    description: 'Used by the driver app background tasks when the socket may be disconnected.',
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' },
        orderId: { type: 'string', description: 'Optional orderId if actively tracking' },
      },
    }
  })
  async syncLocation(
    @Req() req: AuthenticatedRequest,
    @Body() body: { lat: number, lng: number, orderId?: string }
  ) {
    return this.deliveryService.syncLocation(req.user.id, body.lat, body.lng, body.orderId);
  }

  // ─── MY EARNINGS ───────────────────────────────────────────────────────
  @Get('my-earnings')
  @ApiOperation({
    summary: 'Get my delivery stats',
    description: 'Returns total deliveries, rating, and rating count.',
  })
  @ApiResponse({ status: 200, description: 'Driver stats summary' })
  async getMyEarnings(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getMyEarnings(req.user.id);
  }

  // ─── GET ORDER ROUTE (MAP DATA) ────────────────────────────────────────
  @Get('orders/:id/route')
  @ApiOperation({
    summary: 'Get optimized route coordinates',
    description: 'Fetch GPS coordinates for both the Restaurant (Pickup) and Customer (Dropoff) for map rendering.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Route GPS coordinates' })
  async getOrderRoute(
    @Req() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ) {
    return this.deliveryService.getOrderRoute(req.user.id, orderId);
  }
}
