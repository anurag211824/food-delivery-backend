import { Controller, Get, Post, Patch, Body, Req, UseGuards, Query, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ResolveWithdrawalDto } from './dto/resolve-withdrawal.dto';
import { PaginationDto } from '../common/pagination.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, RequestStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Financials & Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/wallets')
export class WalletsController {
    constructor(private readonly walletsService: WalletsService) { }

    @Get('balance')
    @ApiOperation({ summary: 'Get current wallet balance' })
    @ApiResponse({ status: 200, description: 'Returns wallet with balance' })
    async getBalance(@Req() req: AuthenticatedRequest) {
        return this.walletsService.getBalance(req.user.id);
    }

    @Get('transactions')
    @ApiOperation({ summary: 'Get wallet transaction history' })
    @ApiResponse({ status: 200, description: 'Returns list of wallet transactions' })
    async getTransactions(@Req() req: AuthenticatedRequest, @Query() dto: PaginationDto) {
        return this.walletsService.getTransactions(req.user.id, dto);
    }

    @Post('topup')
    @ApiOperation({ summary: 'Initialize Wallet Topup via Razorpay' })
    @ApiResponse({ status: 201, description: 'Razorpay topup order created' })
    @Throttle({ default: { ttl: 60000, limit: 10 } }) // Stricter: 10 topups per minute
    async topup(@Req() req: AuthenticatedRequest, @Body() dto: TopupWalletDto) {
        return this.walletsService.topup(req.user.id, dto);
    }

    @Post('verify')
    @ApiOperation({ summary: 'Verify Wallet Topup Signature' })
    @ApiResponse({ status: 200, description: 'Topup verified and money added to wallet' })
    async verifyTopup(@Req() req: AuthenticatedRequest, @Body() verifyDto: VerifyTopupDto) {
        return this.walletsService.verifyTopup(req.user.id, verifyDto);
    }

    // ─── WITHDRAWALS ──────────────────────────────────────────────────────
    @Post('withdrawals')
    @ApiOperation({ summary: 'Request wallet withdrawal (Payout)' })
    @ApiResponse({ status: 201, description: 'Withdrawal requested, funds held' })
    @Throttle({ default: { ttl: 60000, limit: 5 } }) // Stricter: 5 withdrawals per minute
    async requestWithdrawal(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreateWithdrawalDto,
    ) {
        return this.walletsService.requestWithdrawal(req.user.id, dto);
    }

    @Get('withdrawals/my')
    @ApiOperation({ summary: 'Get my withdrawal requests' })
    async getMyWithdrawals(@Req() req: AuthenticatedRequest, @Query() dto: PaginationDto) {
        return this.walletsService.getMyWithdrawals(req.user.id, dto);
    }

    @Get('withdrawals/all')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '[Admin] View all withdrawal requests' })
    async getAllWithdrawals(@Query() dto: PaginationDto, @Query('status') status?: RequestStatus) {
        return this.walletsService.getAllWithdrawals(dto, status);
    }

    @Patch('withdrawals/:id/resolve')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: '[Admin] Approve or reject a withdrawal' })
    async resolveWithdrawal(
        @Param('id') id: string,
        @Body() dto: ResolveWithdrawalDto,
    ) {
        return this.walletsService.resolveWithdrawal(id, dto);
    }
}
