import {
    Controller, Get, Post, Patch, Body, Param, Query,
    Req, UseGuards,
} from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
    ApiParam, ApiQuery, ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Coupons & Promotions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/coupons')
export class CouponsController {
    constructor(private readonly couponsService: CouponsService) { }

    // ─── ADMIN: CREATE ────────────────────────────────────────────────────
    @Post()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '[Admin] Create a new promo coupon' })
    @ApiResponse({ status: 201, description: 'Coupon created successfully' })
    async create(@Body() dto: CreateCouponDto) {
        return this.couponsService.create(dto);
    }

    // ─── ADMIN: LIST ALL ──────────────────────────────────────────────────
    @Get('all')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '[Admin] List all coupons' })
    async findAll() {
        return this.couponsService.findAll();
    }

    // ─── ADMIN: TOGGLE ACTIVE ─────────────────────────────────────────────
    @Patch(':id/activate')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '[Admin] Activate a coupon' })
    @ApiParam({ name: 'id' })
    async activate(@Param('id') id: string) {
        return this.couponsService.toggleActive(id, true);
    }

    @Patch(':id/deactivate')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '[Admin] Deactivate a coupon' })
    @ApiParam({ name: 'id' })
    async deactivate(@Param('id') id: string) {
        return this.couponsService.toggleActive(id, false);
    }

    // ─── CUSTOMER: AVAILABLE COUPONS ──────────────────────────────────────
    @Get('available')
    @ApiOperation({ summary: 'Get coupons available for me' })
    @ApiResponse({ status: 200, description: 'List of valid coupons the user can apply' })
    async getAvailable(@Req() req: AuthenticatedRequest) {
        return this.couponsService.getAvailableForUser(req.user.id);
    }

    // ─── CUSTOMER: VALIDATE A CODE ────────────────────────────────────────
    @Post('validate')
    @ApiOperation({
        summary: 'Validate a promo code before checkout',
        description: 'Check if a coupon is valid for this user and order total. Returns the discount amount.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                code: { type: 'string', example: 'SAVE50' },
                orderTotal: { type: 'number', example: 450 },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Coupon is valid, discount returned' })
    @ApiResponse({ status: 400, description: 'Coupon is invalid, expired, or already used' })
    async validate(
        @Body('code') code: string,
        @Body('orderTotal') orderTotal: number,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.couponsService.validate(code, req.user.id, orderTotal);
    }
}
