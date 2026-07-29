import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PickerStatus, Role } from '@prisma/client';
import { StoreManagementService } from './store-management.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { GetStatsDto } from '../restaurants/dto/get-stats.dto';
import { DashboardQueryDto } from '../restaurants/dto/dashboard-query.dto';

@ApiTags('Store Management (Instamart)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('api/store-management')
export class StoreManagementController {
  constructor(
    private readonly storeManagementService: StoreManagementService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // STORE MANAGER ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Post(':storeId/pickers')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Add a picker to the store' })
  @ApiParam({ name: 'storeId', description: 'The dark store ID' })
  @ApiBody({ schema: { example: { userId: 'user_cuid', name: 'Rahul' } } })
  @ApiResponse({ status: 201, description: 'Picker added successfully' })
  async addPicker(
    @Param('storeId') storeId: string,
    @Body() dto: { userId: string; name: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.addPicker(storeId, req.user.id, dto);
  }

  @Delete(':storeId/pickers/:pickerId')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Remove a picker from the store' })
  @ApiParam({ name: 'storeId' })
  @ApiParam({ name: 'pickerId' })
  @ApiResponse({ status: 200, description: 'Picker removed successfully' })
  async removePicker(
    @Param('storeId') storeId: string,
    @Param('pickerId') pickerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.removePicker(
      storeId,
      pickerId,
      req.user.id,
    );
  }

  @Get(':storeId/pickers')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] List all pickers at the store' })
  @ApiParam({ name: 'storeId' })
  @ApiResponse({ status: 200, description: 'List of store pickers' })
  async listPickers(
    @Param('storeId') storeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.listPickers(storeId, req.user.id);
  }

  @Get(':storeId/dashboard')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: '[Store Manager] Get live store dashboard with picker stats',
  })
  @ApiParam({ name: 'storeId' })
  @ApiResponse({ status: 200, description: 'Store dashboard overview' })
  async getDashboard(
    @Param('storeId') storeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.getStoreDashboard(storeId, req.user.id);
  }

  @Post(':storeId/pickers/create')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary:
      '[Store Manager] Create a new picker user account and link to store (IAM-style)',
  })
  @ApiParam({ name: 'storeId', description: 'The dark store ID' })
  @ApiBody({
    schema: {
      example: {
        name: 'Rahul',
        email: 'rahul@instamart.com',
        password: 'securePassword123',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Picker account created and linked successfully.',
  })
  async createPicker(
    @Param('storeId') storeId: string,
    @Body() dto: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.createPickerWithCredentials(
      storeId,
      req.user.id,
      dto,
    );
  }

  @Get('my-store')
  @Roles(Role.STORE_MANAGER)
  @ApiOperation({
    summary: '[Store Manager] Fetch details of store managed by logged in user',
  })
  @ApiResponse({ status: 200, description: 'Managed store details.' })
  async getMyStore(@Req() req: AuthenticatedRequest) {
    return this.storeManagementService.getMyStore(req.user.id);
  }

  @Patch('my-store/profile')
  @Roles(Role.STORE_MANAGER)
  @ApiOperation({
    summary: '[Store Manager] Update managed store profile details',
  })
  @ApiBody({
    schema: {
      example: {
        name: 'Instamart - Indiranagar',
        description: 'Faster grocery delivery',
        address: '123 Main Road',
        lat: 12.9716,
        lng: 77.5946,
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Store profile updated.' })
  async updateStoreProfile(@Body() dto: any, @Req() req: AuthenticatedRequest) {
    return this.storeManagementService.updateStoreProfile(req.user.id, dto);
  }

  @Patch('my-store/open-status')
  @Roles(Role.STORE_MANAGER)
  @ApiOperation({ summary: '[Store Manager] Toggle store Open/Closed status' })
  @ApiBody({ schema: { example: { isOpen: false } } })
  @ApiResponse({ status: 200, description: 'Store open status updated.' })
  async toggleStoreOpen(
    @Body('isOpen') isOpen: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.toggleStoreOpen(req.user.id, isOpen);
  }

  @Get('my-store/orders')
  @Roles(Role.STORE_MANAGER)
  @ApiOperation({
    summary: '[Store Manager] View all orders placed at their store',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of store orders.' })
  async getStoreOrders(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.storeManagementService.getStoreOrders(
      req.user.id,
      status,
      page,
      limit,
    );
  }

  @Get('stats')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: '[Store Manager] Get full store analytics stats',
    description:
      'Returns KPIs with trend comparison (% growth vs previous period), revenue graph, top grocery products, and payment breakdown.',
  })
  @ApiResponse({ status: 200, description: 'Store analytics data.' })
  async getStats(
    @Query() dto: GetStatsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.getStoreStats(
      req.user,
      dto.period,
      dto.storeId,
    );
  }

  @Get('dashboard-stats')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: '[Store Manager] Get range-filtered store dashboard metrics',
    description:
      'Fetch total grocery orders, total revenue, active picking orders, and cancellations for custom date range.',
  })
  @ApiResponse({ status: 200, description: 'Store dashboard metrics.' })
  async getDashboardStats(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.getStoreDashboardStats(
      req.user,
      query.startDate,
      query.endDate,
      query.storeId,
    );
  }

  @Get('my-store/settlements')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: '[Store Manager] Get Dark Store Settlements',
    description:
      'Returns a paginated list of all nightly settlements for this dark store.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getMyStoreSettlements(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.getMyStoreSettlements(
      req.user,
      Math.max(1, parseInt(page, 10)),
      Math.min(100, Math.max(1, parseInt(limit, 10))),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PICKER ENDPOINTS (used by the warehouse picker's app/terminal)
  // ═══════════════════════════════════════════════════════════════

  @Patch('picker/status')
  @Roles(Role.STORE_PICKER)
  @ApiOperation({ summary: '[Picker] Update own availability status' })
  @ApiBody({ schema: { example: { status: 'AVAILABLE' } } })
  @ApiResponse({ status: 200, description: 'Picker status updated' })
  async updateMyStatus(
    @Body('status') status: PickerStatus,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.updatePickerStatus(req.user.id, status);
  }

  @Get('picker/orders')
  @Roles(Role.STORE_PICKER, Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Picker] Get my assigned orders to pick' })
  @ApiResponse({ status: 200, description: 'List of assigned orders' })
  async getMyOrders(@Req() req: AuthenticatedRequest) {
    return this.storeManagementService.getPickerOrders(req.user.id);
  }

  @Patch('picker/orders/:orderId/partial-fulfill')
  @Roles(Role.STORE_PICKER, Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: '[Picker/Manager] Adjust order items for missing/out-of-stock items & auto-refund',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID to adjust' })
  @ApiBody({
    schema: {
      example: {
        itemUpdates: [{ orderItemId: 'cuid_1', newQuantity: 1 }],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Order adjusted and difference refunded to user wallet',
  })
  async partiallyFulfillOrder(
    @Param('orderId') orderId: string,
    @Body('itemUpdates')
    itemUpdates: { orderItemId: string; newQuantity: number }[],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.storeManagementService.partiallyFulfillOrder(
      req.user.id,
      orderId,
      itemUpdates,
    );
  }

  @Get('picker/orders/:orderId/verify-barcode')
  @Roles(Role.STORE_PICKER, Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: '[Picker] Verify scanned barcode/SKU against order line items',
  })
  @ApiParam({ name: 'orderId' })
  @ApiQuery({ name: 'barcode', example: '8901030700012' })
  @ApiResponse({ status: 200, description: 'Barcode verification result' })
  async verifyBarcode(
    @Param('orderId') orderId: string,
    @Query('barcode') barcode: string,
  ) {
    return this.storeManagementService.verifyBarcode(orderId, barcode);
  }
}
