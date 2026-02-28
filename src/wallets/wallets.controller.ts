import { Controller, Get, Post, Body, Req, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { PaginationDto } from '../common/pagination.dto';
import { AuthGuard } from '../auth/auth.guard';
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
    async topup(@Req() req: AuthenticatedRequest, @Body() dto: TopupWalletDto) {
        return this.walletsService.topup(req.user.id, dto);
    }

    @Post('verify')
    @ApiOperation({ summary: 'Verify Wallet Topup Signature' })
    @ApiResponse({ status: 200, description: 'Topup verified and money added to wallet' })
    async verifyTopup(@Req() req: AuthenticatedRequest, @Body() verifyDto: VerifyTopupDto) {
        return this.walletsService.verifyTopup(verifyDto);
    }
}
