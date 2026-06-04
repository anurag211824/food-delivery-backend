import {
    Controller, Get, Patch, Post, Body, Query, Param,
    UseGuards, Req,
} from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
    ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { RequestStatus, Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { PayoutsService } from '../payouts/payouts.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ManualRefundDto } from './dto/manual-refund.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly payoutsService: PayoutsService,
    ) { }

    // ─── LIST USERS ───────────────────────────────────────────────────────────
    @Get('users')
    @ApiOperation({ summary: '[Admin] List all users', description: 'Returns a paginated list of all users. Filter by role.' })
    @ApiQuery({ name: 'role', required: false, enum: Role })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    async listUsers(
        @Query('role') role?: Role,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.adminService.listUsers(
            role,
            Math.max(1, parseInt(page, 10)),
            Math.min(100, Math.max(1, parseInt(limit, 10))),
        );
    }

    // ─── UPDATE USER ROLE ─────────────────────────────────────────────────────
    @Patch('users/role')
    @ApiOperation({ summary: '[Admin] Manually change a user\'s role', description: 'Directly promote or demote any user. For restaurant/delivery partners, prefer the approve endpoints instead.' })
    @ApiBody({ type: UpdateUserRoleDto })
    async updateUserRole(@Body() dto: UpdateUserRoleDto, @Req() req: AuthenticatedRequest) {
        return this.adminService.updateUserRole(dto, req.user.id);
    }

    @Post('users')
    @ApiOperation({ summary: '[Admin] Create a new user account', description: 'Directly create a user with a specific role. Useful for onboarding managers manually.' })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    async createUser(@Body() dto: CreateUserDto) {
        return this.adminService.createUser(dto);
    }

    // ─── BAN / VERIFY RESTAURANT ──────────────────────────────────────────────
    @Patch('restaurants/:id/activate')
    @ApiOperation({ summary: '[Admin] Activate a restaurant' })
    @ApiParam({ name: 'id' })
    async activateRestaurant(@Param('id') id: string) {
        return this.adminService.toggleRestaurantActive(id, true);
    }

    @Patch('restaurants/:id/deactivate')
    @ApiOperation({ summary: '[Admin] Deactivate (ban) a restaurant' })
    @ApiParam({ name: 'id' })
    async deactivateRestaurant(@Param('id') id: string) {
        return this.adminService.toggleRestaurantActive(id, false);
    }

    @Patch('restaurants/:id/verify')
    @ApiOperation({ summary: '[Admin] Verify a restaurant' })
    @ApiParam({ name: 'id' })
    async verifyRestaurant(@Param('id') id: string) {
        return this.adminService.verifyRestaurant(id, true);
    }

    @Patch('restaurants/:id/unverify')
    @ApiOperation({ summary: '[Admin] Unverify a restaurant' })
    @ApiParam({ name: 'id' })
    async unverifyRestaurant(@Param('id') id: string) {
        return this.adminService.verifyRestaurant(id, false);
    }

    // ─── PARTNER MANAGEMENT (RESTAURANTS) ───────────────────────────────────
    @Get('restaurants')
    @ApiOperation({
        summary: '[Admin] List all registered restaurants',
        description: 'Returns all restaurants regardless of active status, explicitly for admin listing.',
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiQuery({ name: 'storeName', required: false, description: 'Search by restaurant name' })
    async listRestaurants(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('storeName') storeName?: string,
    ) {
        return this.adminService.listRestaurants(
            Math.max(1, parseInt(page, 10)),
            Math.min(100, Math.max(1, parseInt(limit, 10))),
            storeName,
        );
    }

    // ─── LIST PARTNER REQUESTS ────────────────────────────────────────────────
    @Get('requests')
    @ApiOperation({
        summary: '[Admin] List partner applications',
        description: 'List restaurant or delivery partner applications. Filter by status to see what is pending.',
    })
    @ApiQuery({ name: 'type', required: true, enum: ['restaurant', 'delivery'], description: 'Type of request to list' })
    @ApiQuery({ name: 'status', required: false, enum: RequestStatus, description: 'Filter by status (default: all)' })
    @ApiResponse({ status: 200, description: 'List of requests with the applicant\'s user details' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    async listRequests(
        @Query('type') type: 'restaurant' | 'delivery',
        @Query('status') status?: RequestStatus,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.adminService.listRequests(
            type,
            status,
            Math.max(1, parseInt(page, 10)),
            Math.min(100, Math.max(1, parseInt(limit, 10))),
        );
    }

    // ─── RESTAURANT REQUEST: APPROVE / REJECT ─────────────────────────────────
    @Patch('requests/restaurant/:id/approve')
    @ApiOperation({
        summary: '[Admin] Approve a restaurant application',
        description: 'Atomically: marks request APPROVED + sets user role to RESTAURANT_MANAGER + creates the Restaurant record.',
    })
    @ApiParam({ name: 'id', description: 'RestaurantRequest ID' })
    @ApiResponse({ status: 200, description: 'Approved — Restaurant and manager role created.' })
    @ApiResponse({ status: 400, description: 'Request is not in PENDING state' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    async approveRestaurantRequest(@Param('id') id: string) {
        return this.adminService.approveRestaurantRequest(id);
    }

    @Patch('requests/restaurant/:id/reject')
    @ApiOperation({
        summary: '[Admin] Reject a restaurant application',
        description: 'Marks the request as REJECTED with an optional reason. User stays as CUSTOMER.',
    })
    @ApiParam({ name: 'id', description: 'RestaurantRequest ID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                reason: { type: 'string', example: 'FSSAI license could not be verified.' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Request rejected.' })
    async rejectRestaurantRequest(@Param('id') id: string, @Body('reason') reason?: string) {
        return this.adminService.rejectRestaurantRequest(id, reason);
    }

    // ─── DELIVERY REQUEST: APPROVE / REJECT ──────────────────────────────────
    @Patch('requests/delivery/:id/approve')
    @ApiOperation({
        summary: '[Admin] Approve a delivery partner application',
        description: 'Atomically: marks request APPROVED + sets user role to DELIVERY_PARTNER + creates the DriverProfile record.',
    })
    @ApiParam({ name: 'id', description: 'DeliveryPartnerRequest ID' })
    @ApiResponse({ status: 200, description: 'Approved — DriverProfile and partner role created.' })
    @ApiResponse({ status: 400, description: 'Request is not in PENDING state' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    async approveDeliveryRequest(@Param('id') id: string) {
        return this.adminService.approveDeliveryRequest(id);
    }

    @Patch('requests/delivery/:id/reject')
    @ApiOperation({
        summary: '[Admin] Reject a delivery partner application',
        description: 'Marks the request as REJECTED with an optional reason. User stays as CUSTOMER.',
    })
    @ApiParam({ name: 'id', description: 'DeliveryPartnerRequest ID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                reason: { type: 'string', example: 'Driving license could not be verified.' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Request rejected.' })
    async rejectDeliveryRequest(@Param('id') id: string, @Body('reason') reason?: string) {
        return this.adminService.rejectDeliveryRequest(id, reason);
    }

    // ─── PLATFORM STATS ───────────────────────────────────────────────────
    @Get('stats')
    @ApiOperation({
        summary: '[Admin] Platform dashboard stats',
        description: 'Returns total users, restaurants, orders, revenue, active drivers, and pending requests — all in one call.',
    })
    @ApiResponse({
        status: 200,
        description: 'Platform stats',
        schema: {
            example: {
                totalUsers: 500, totalRestaurants: 20, totalOrders: 1200,
                todayOrders: 45, totalRevenue: 350000, activeDrivers: 8,
                pendingRequests: { restaurant: 3, delivery: 5 },
            },
        },
    })
    async getPlatformStats() {
        return this.adminService.getPlatformStats();
    }

    // ─── ALL ORDERS ───────────────────────────────────────────────────────
    @Get('orders')
    @ApiOperation({
        summary: '[Admin] List all platform orders',
        description: 'Paginated list of all orders across the platform. Filter by status.',
    })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by order status (e.g. PLACED, DELIVERED, CANCELLED)' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    async getAllOrders(
        @Query('status') status?: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.adminService.getAllOrders(
            status,
            Math.max(1, parseInt(page, 10)),
            Math.min(100, Math.max(1, parseInt(limit, 10))),
        );
    }

    // ─── ADMIN: MANUAL REFUND ─────────────────────────────────────────────
    @Post('refunds/manual')
    @ApiOperation({
        summary: '[Admin] Manually issue a refund for an order',
        description: 'Issues a custom/partial refund directly to the customer wallet and records the refund.',
    })
    @ApiBody({ type: ManualRefundDto })
    async manualRefund(@Body() dto: ManualRefundDto) {
        return this.adminService.manualRefund(dto);
    }

    // ─── ADMIN: GET SETTLEMENTS ───────────────────────────────────────────
    @Get('settlements')
    @ApiOperation({
        summary: '[Admin] List restaurant settlements',
        description: 'Returns a paginated list of all restaurant settlements. Can filter by status (PENDING, PAID).',
    })
    @ApiQuery({ name: 'status', required: false, description: 'Filter settlements by status' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    async getSettlements(
        @Query('status') status?: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.payoutsService.getSettlements(
            status,
            Math.max(1, parseInt(page, 10)),
            Math.min(100, Math.max(1, parseInt(limit, 10))),
        );
    }

    // ─── ADMIN: PAY OUT SETTLEMENT ────────────────────────────────────────
    @Post('settlements/:id/pay')
    @ApiOperation({
        summary: '[Admin] Mark a settlement as PAID',
        description: 'Resolves a settlement and marks it as PAID.',
    })
    @ApiParam({ name: 'id', description: 'Settlement ID' })
    async paySettlement(@Param('id') id: string) {
        return this.payoutsService.resolveSettlement(id);
    }

    // ─── ADMIN: TRIGGER AD-HOC SETTLEMENTS RUN ────────────────────────────
    @Post('settlements/trigger')
    @ApiOperation({
        summary: '[Admin] Trigger ad-hoc settlements calculation',
        description: 'Manually runs the settlement calculation engine for the previous day.',
    })
    async triggerSettlementRun() {
        return this.payoutsService.triggerManualSettlementRun();
    }
}
