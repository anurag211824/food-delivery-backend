import {
  Controller, Get, Post, Body, Patch, Param, Req, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
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


  @Get(":id")
  @ApiOperation({summary: "get order data by orderid"})
  @ApiResponse({status:200, description:"order data"})
  async getOrder(@Param('id') id:string){
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

  @Get('my-history')
  @ApiOperation({ summary: 'Get current user order history' })
  async getMyOrders(@Req() req: AuthenticatedRequest) {
    const user = (req as any).user;
    return this.ordersService.getCustomerOrders(user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (Manager/Admin Only)' })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @UseGuards(RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Req() req: AuthenticatedRequest
  ) {
    const user = (req as any).user;
    return this.ordersService.updateStatus(id, status, user.id);
  }


  @Get('restaurant')
  @ApiOperation({ summary: "Get Orders for managed restaurant (Manager Only)" })
  @UseGuards(RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  async getRestaurantOrders(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return this.ordersService.getRestaurantOrders(user.id)
  }



}