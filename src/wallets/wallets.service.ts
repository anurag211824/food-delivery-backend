import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class WalletsService {
    private razorpay: any;

    constructor(private prisma: PrismaService) {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_123',
            key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret123',
        });
    }

    async getBalance(userId: string) {
        let wallet = await this.prisma.wallet.findUnique({
            where: { userId },
        });

        if (!wallet) {
            wallet = await this.prisma.wallet.create({
                data: { userId, balance: 0.0 },
            });
        }

        return wallet;
    }

    async getTransactions(userId: string) {
        const wallet = await this.getBalance(userId);

        return this.prisma.walletTransaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: 'desc' },
        });
    }

    async topup(userId: string, dto: TopupWalletDto) {
        const wallet = await this.getBalance(userId);

        try {
            const topupRequest = await this.prisma.walletTopupRequest.create({
                data: {
                    walletId: wallet.id,
                    amount: dto.amount,
                    status: PaymentStatus.PENDING,
                },
            });

            const options = {
                amount: Math.round(dto.amount * 100), // INR paise
                currency: 'INR',
                receipt: `wallet_topup_${topupRequest.id}`,
            };

            const razorpayOrder = await this.razorpay.orders.create(options);

            await this.prisma.walletTopupRequest.update({
                where: { id: topupRequest.id },
                data: { razorpayOrderId: razorpayOrder.id },
            });

            return {
                razorpayOrder,
                topupRequestId: topupRequest.id,
                amount: dto.amount,
            };
        } catch (error: any) {
            throw new InternalServerErrorException(error.message || 'Error creating Razorpay wallet topup order');
        }
    }

    async verifyTopup(verifyDto: VerifyTopupDto) {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyDto;
        const secret = process.env.RAZORPAY_KEY_SECRET || 'secret123';

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpaySignature) {
            await this.prisma.walletTopupRequest.updateMany({
                where: { razorpayOrderId },
                data: { status: PaymentStatus.FAILED },
            });
            throw new BadRequestException('Invalid topup signature');
        }

        const topupRequest = await this.prisma.walletTopupRequest.findUnique({
            where: { razorpayOrderId },
        });

        if (!topupRequest || topupRequest.status === PaymentStatus.SUCCESS) {
            throw new BadRequestException('Topup request not found or already processed');
        }

        return this.prisma.$transaction(async (prisma) => {
            // Mark topup successful
            await prisma.walletTopupRequest.update({
                where: { id: topupRequest.id },
                data: { status: PaymentStatus.SUCCESS },
            });

            // Create transaction history
            const transaction = await prisma.walletTransaction.create({
                data: {
                    walletId: topupRequest.walletId,
                    amount: topupRequest.amount,
                    type: 'TOPUP',
                },
            });

            // Increment wallet
            const updatedWallet = await prisma.wallet.update({
                where: { id: topupRequest.walletId },
                data: { balance: { increment: topupRequest.amount } },
            });

            return { success: true, balance: updatedWallet.balance, transaction };
        });
    }

    async charge(userId: string, amount: number, reason: string) {
        const wallet = await this.getBalance(userId);
        if (wallet.balance < amount) {
            throw new BadRequestException('Insufficient wallet balance');
        }

        return this.prisma.$transaction(async (prisma) => {
            const transaction = await prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: -amount,
                    type: reason, // e.g. 'ORDER_PAYMENT'
                },
            });

            const updatedWallet = await prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: amount } },
            });

            return { transaction, balance: updatedWallet.balance };
        });
    }
}
