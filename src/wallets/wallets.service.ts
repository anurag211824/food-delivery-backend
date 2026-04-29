import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { VerifyTopupDto } from './dto/verify-topup.dto';
import { PaginationDto } from '../common/pagination.dto';
import { PaymentStatus, TransactionDirection } from '@prisma/client';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class WalletsService {
    private razorpay: any;

    constructor(private prisma: PrismaService) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            console.warn('[WalletsService] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set. Razorpay wallet topups will fail.');
        }
        this.razorpay = new Razorpay({
            key_id: keyId || 'rzp_test_placeholder',
            key_secret: keySecret || 'placeholder_secret',
        });
    }

    async getBalance(userId: string) {
        return this.prisma.wallet.upsert({
            where: { userId },
            update: {},  // If it exists, return as-is
            create: { userId, balance: 0.0 },
        });
    }

    async getTransactions(userId: string, dto: PaginationDto) {
        const wallet = await this.getBalance(userId);

        const pageNumber = dto.page || 1;
        const limitNumber = dto.limit || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const [data, total, topupSum, debitSum] = await Promise.all([
            this.prisma.walletTransaction.findMany({
                where: { walletId: wallet.id },
                skip,
                take: limitNumber,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.walletTransaction.count({
                where: { walletId: wallet.id }
            }),
            this.prisma.walletTransaction.aggregate({
                where: { walletId: wallet.id, direction: 'CREDIT' },
                _sum: { amount: true }
            }),
            this.prisma.walletTransaction.aggregate({
                where: { walletId: wallet.id, direction: 'DEBIT' },
                _sum: { amount: true }
            })
        ]);

        return {
            data,
            meta: {
                total,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(total / limitNumber),
                totalAdded: topupSum._sum?.amount || 0,
                totalSpent: debitSum._sum?.amount || 0,
            }
        };
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

    async verifyTopup(userId: string, verifyDto: VerifyTopupDto) {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyDto;
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            throw new InternalServerErrorException('Payment verification is not configured. Contact support.');
        }

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
            include: { wallet: true },
        });

        if (!topupRequest || topupRequest.status === PaymentStatus.SUCCESS) {
            throw new BadRequestException('Topup request not found or already processed');
        }

        // Security: Verify the topup belongs to the requesting user
        if (topupRequest.wallet.userId !== userId) {
            throw new BadRequestException('You are not authorized to verify this topup.');
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
                    direction: TransactionDirection.CREDIT,
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
        // Ensure wallet exists before entering transaction
        const wallet = await this.getBalance(userId);

        return this.prisma.$transaction(async (prisma) => {
            // Row-level lock: re-read balance inside the transaction to prevent double-spend
            const [lockedWallet] = await prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM "Wallet" WHERE "id" = $1 FOR UPDATE`,
                wallet.id,
            );

            if (!lockedWallet || lockedWallet.balance < amount) {
                throw new BadRequestException('Insufficient wallet balance');
            }

            const transaction = await prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: amount,
                    direction: TransactionDirection.DEBIT,
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

    async addFunds(userId: string, amount: number, reason: string) {
        const wallet = await this.getBalance(userId);

        return this.prisma.$transaction(async (prisma) => {
            const transaction = await prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: amount,
                    direction: TransactionDirection.CREDIT,
                    type: reason,
                },
            });

            const updatedWallet = await prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } },
            });

            return { transaction, balance: updatedWallet.balance };
        });
    }

    /**
     * Force-debit a wallet WITHOUT requiring sufficient balance.
     * This allows the balance to go negative.
     * Used exclusively for COD settlement — the rider collected cash
     * and owes the platform/restaurant share.
     */
    async forceCharge(userId: string, amount: number, reason: string) {
        const wallet = await this.getBalance(userId);

        return this.prisma.$transaction(async (prisma) => {
            const transaction = await prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: amount,
                    direction: TransactionDirection.DEBIT,
                    type: reason,
                },
            });

            const updatedWallet = await prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: amount } },
            });

            return { transaction, balance: updatedWallet.balance };
        });
    }

    // ─── WITHDRAWALS (Rider / Manager Payouts) ────────────────────────────

    async requestWithdrawal(userId: string, dto: import('./dto/create-withdrawal.dto').CreateWithdrawalDto) {
        // Prevent multiple pending withdrawals
        const pending = await this.prisma.withdrawal.findFirst({
            where: { userId, status: 'PENDING' }
        });
        if (pending) {
            throw new BadRequestException('You already have a pending withdrawal request.');
        }

        // 1. Immediately deduct the funds (Lock in)
        await this.charge(userId, dto.amount, 'WITHDRAWAL_HOLD');

        // 2. Create the withdrawal request
        return this.prisma.withdrawal.create({
            data: {
                userId,
                amount: dto.amount,
                bankAccountName: dto.bankAccountName,
                bankAccountNumber: dto.bankAccountNumber,
                ifscCode: dto.ifscCode,
            },
        });
    }

    async getMyWithdrawals(userId: string, dto: PaginationDto) {
        const pageNumber = dto.page || 1;
        const limitNumber = dto.limit || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const [data, total] = await Promise.all([
            this.prisma.withdrawal.findMany({
                where: { userId },
                skip,
                take: limitNumber,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.withdrawal.count({ where: { userId } })
        ]);

        return { data, meta: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) } };
    }

    async getAllWithdrawals(dto: PaginationDto, status?: import('@prisma/client').RequestStatus) {
        const pageNumber = dto.page || 1;
        const limitNumber = dto.limit || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const where = status ? { status } : {};

        const [data, total] = await Promise.all([
            this.prisma.withdrawal.findMany({
                where,
                skip,
                take: limitNumber,
                include: { user: { select: { name: true, email: true, role: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.withdrawal.count({ where })
        ]);

        return { data, meta: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) } };
    }

    async resolveWithdrawal(id: string, dto: import('./dto/resolve-withdrawal.dto').ResolveWithdrawalDto) {
        const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
        if (!withdrawal) throw new NotFoundException('Withdrawal request not found.');
        if (withdrawal.status !== 'PENDING') throw new BadRequestException(`Withdrawal is already ${withdrawal.status}.`);

        // Update withdrawal status
        const updated = await this.prisma.withdrawal.update({
            where: { id },
            data: {
                status: dto.status,
                rejectionReason: dto.rejectionReason,
                processedAt: new Date(),
            },
        });

        // If rejected, refund the money back to the user's app wallet
        if (dto.status === 'REJECTED') {
            await this.addFunds(
                withdrawal.userId,
                withdrawal.amount,
                `WITHDRAWAL_REJECTED_REFUND:${id}`,
            );
        }

        return { message: `Withdrawal marked as ${dto.status}`, withdrawal: updated };
    }
}
