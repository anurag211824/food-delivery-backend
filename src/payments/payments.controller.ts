import { Controller, Post, Body, Req, UseGuards, Headers, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateSavedPaymentDto } from './dto/create-saved-payment.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Financials & Payments')
@Controller('api/payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('create-order')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Initialize Razorpay Order' })
    @ApiResponse({ status: 201, description: 'Razorpay order created successfully' })
    async createRazorpayOrder(@Req() req: AuthenticatedRequest, @Body() createPaymentDto: CreatePaymentDto) {
        return this.paymentsService.createRazorpayOrder(req.user.id, createPaymentDto);
    }

    @Post('verify')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Verify Razorpay Payment Signature' })
    @ApiResponse({ status: 200, description: 'Payment verified and order marked as paid' })
    async verifyPayment(@Req() req: AuthenticatedRequest, @Body() verifyPaymentDto: VerifyPaymentDto) {
        return this.paymentsService.verifyPayment(req.user.id, verifyPaymentDto);
    }

    @Post('webhook')
    @ApiExcludeEndpoint() // Hide from swagger
    async handleWebhook(
        @Headers('x-razorpay-signature') signature: string,
        @Headers('x-razorpay-event-id') eventId: string,
        @Body() body: any
    ) {
        return this.paymentsService.handleWebhook(body, signature, eventId);
    }

    // --- SAVED PAYMENT METHODS ---

    @Get('saved-methods')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get saved payment methods' })
    async getSavedMethods(@Req() req: AuthenticatedRequest) {
        return this.paymentsService.getSavedMethods(req.user.id);
    }

    @Post('saved-methods')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Save a new payment method' })
    async saveMethod(@Req() req: AuthenticatedRequest, @Body() dto: CreateSavedPaymentDto) {
        return this.paymentsService.saveMethod(req.user.id, dto);
    }

    @Delete('saved-methods/:id')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Delete a saved payment method' })
    async removeSavedMethod(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.paymentsService.removeSavedMethod(req.user.id, id);
    }
}
