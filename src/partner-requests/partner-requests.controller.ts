import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PartnerRequestsService } from './partner-requests.service';
import { CreateRestaurantRequestDto } from './dto/create-restaurant-request.dto';
import { CreateDeliveryRequestDto } from './dto/create-delivery-request.dto';
import { CreateStoreRequestDto } from './dto/create-store-request.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Partner Onboarding')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/partner-requests')
export class PartnerRequestsController {
    constructor(private readonly partnerRequestsService: PartnerRequestsService) { }

    // ─── RESTAURANT: SUBMIT ───────────────────────────────────────────────────
    @Post('restaurant')
    @ApiOperation({
        summary: 'Submit a restaurant partner application',
        description: 'Any logged-in user can apply to become a restaurant partner. Submit the restaurant details — the admin will review and approve or reject the request. You can only have one active application.',
    })
    @ApiBody({ type: CreateRestaurantRequestDto })
    @ApiResponse({
        status: 201,
        description: 'Application submitted successfully. Status is PENDING.',
        schema: { example: { id: 'req_123', status: 'PENDING', restaurantName: "Priya's Kitchen" } },
    })
    @ApiResponse({ status: 409, description: 'You already have an existing application' })
    async submitRestaurantRequest(
        @Body() dto: CreateRestaurantRequestDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.partnerRequestsService.submitRestaurantRequest(req.user.id, dto);
    }

    // ─── RESTAURANT: GET MY STATUS ────────────────────────────────────────────
    @Get('restaurant/me')
    @ApiOperation({
        summary: 'Get my restaurant application status',
        description: 'Check the current status of your restaurant partner application (PENDING, APPROVED, or REJECTED).',
    })
    @ApiResponse({
        status: 200,
        description: 'Your restaurant application',
        schema: { example: { id: 'req_123', status: 'PENDING', restaurantName: "Priya's Kitchen", createdAt: '2026-03-09T00:00:00Z' } },
    })
    @ApiResponse({ status: 404, description: 'No application found for your account' })
    async getMyRestaurantRequest(@Req() req: AuthenticatedRequest) {
        return this.partnerRequestsService.getMyRestaurantRequest(req.user.id);
    }

    // ─── DELIVERY: SUBMIT ─────────────────────────────────────────────────────
    @Post('delivery')
    @ApiOperation({
        summary: 'Submit a delivery partner application',
        description: 'Any logged-in user can apply to become a delivery partner. Submit your vehicle details — the admin will review and approve or reject the request.',
    })
    @ApiBody({ type: CreateDeliveryRequestDto })
    @ApiResponse({
        status: 201,
        description: 'Application submitted. Status is PENDING.',
        schema: { example: { id: 'dreq_123', status: 'PENDING', vehicleType: 'Bike' } },
    })
    @ApiResponse({ status: 409, description: 'You already have an existing application' })
    async submitDeliveryRequest(
        @Body() dto: CreateDeliveryRequestDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.partnerRequestsService.submitDeliveryRequest(req.user.id, dto);
    }

    // ─── DELIVERY: GET MY STATUS ──────────────────────────────────────────────
    @Get('delivery/me')
    @ApiOperation({
        summary: 'Get my delivery partner application status',
        description: 'Check the current status of your delivery partner application (PENDING, APPROVED, or REJECTED).',
    })
    @ApiResponse({
        status: 200,
        description: 'Your delivery partner application',
        schema: { example: { id: 'dreq_123', status: 'APPROVED', vehicleType: 'Bike', createdAt: '2026-03-09T00:00:00Z' } },
    })
    @ApiResponse({ status: 404, description: 'No application found for your account' })
    async getMyDeliveryRequest(@Req() req: AuthenticatedRequest) {
        return this.partnerRequestsService.getMyDeliveryRequest(req.user.id);
    }

    // ─── GROCERY STORE: SUBMIT ────────────────────────────────────────────────
    @Post('store')
    @ApiOperation({
        summary: 'Submit a grocery store partner application',
        description: 'Any logged-in user can apply to become a grocery store partner. Submit the store details — the admin will review and approve or reject the request. You can only have one active application.',
    })
    @ApiBody({ type: CreateStoreRequestDto })
    @ApiResponse({
        status: 201,
        description: 'Application submitted successfully. Status is PENDING.',
        schema: { example: { id: 'sreq_123', status: 'PENDING', storeName: "Priya's Grocery Mart" } },
    })
    @ApiResponse({ status: 409, description: 'You already have an existing application' })
    async submitStoreRequest(
        @Body() dto: CreateStoreRequestDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.partnerRequestsService.submitStoreRequest(req.user.id, dto);
    }

    // ─── GROCERY STORE: GET MY STATUS ─────────────────────────────────────────
    @Get('store/me')
    @ApiOperation({
        summary: 'Get my grocery store application status',
        description: 'Check the current status of your grocery store partner application (PENDING, APPROVED, or REJECTED).',
    })
    @ApiResponse({
        status: 200,
        description: 'Your grocery store application',
        schema: { example: { id: 'sreq_123', status: 'PENDING', storeName: "Priya's Grocery Mart", createdAt: '2026-03-09T00:00:00Z' } },
    })
    @ApiResponse({ status: 404, description: 'No application found for your account' })
    async getMyStoreRequest(@Req() req: AuthenticatedRequest) {
        return this.partnerRequestsService.getMyStoreRequest(req.user.id);
    }
}
