import {
  Controller, Get, Post, Body, Patch, Delete, Param, Req, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from 'src/auth/auth.types';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard) // ⚡ Enforcement: Blocks unauthenticated users
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }


  @Get('my-history')
  @ApiOperation({ summary: 'Get current user order history' })
  async getMyOrders(@Req() req: AuthenticatedRequest) {
    const user = (req as any).user;
    return this.ordersService.getCustomerOrders(user.id);
  }

  @Get('restaurant')
  @ApiOperation({ summary: "Get Orders for managed restaurant (Manager Only)" })
  @UseGuards(RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  async getRestaurantOrders(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return this.ordersService.getRestaurantOrders(user.id)
  }

  @Get(":id")
  @ApiOperation({ summary: "get order data by orderid" })
  @ApiResponse({ status: 200, description: "order data" })
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Place a new order (Customer)' })
  @ApiResponse({ status: 201, description: 'Order created successfully.' })
  async create(@Req() req: AuthenticatedRequest, @Body() createOrderDto: CreateOrderDto) {
    // req.user is now guaranteed to exist because of the Guard
    const user = (req as any).user;
    return this.ordersService.create(user.id, createOrderDto);
  }



  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (Manager/Admin Only)' })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @UseGuards(RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.ordersService.updateStatus(id, dto.status, req.user);
  }

  // ─── CUSTOMER CANCEL ────────────────────────────────────────────────────
  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel my order (Customer)',
    description: 'Customers can cancel orders with status PLACED or ACCEPTED. Wallet-paid orders are auto-refunded.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled, wallet refunded if applicable.' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled at this stage.' })
  async cancelOrder(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.cancelOrder(req.user.id, id);
  }

  // ─── MANAGER CANCEL ─────────────────────────────────────────────────────
  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an order (Manager)',
    description: 'Restaurant managers can cancel orders before delivery. Wallet-paid orders are auto-refunded.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Kitchen closed unexpectedly.' },
      },
    },
  })
  @UseGuards(RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  async cancelOrderByManager(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.cancelOrderByManager(id, req.user.id, reason);
  }
}
