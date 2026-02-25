import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateSavedPaymentDto } from './dto/create-saved-payment.dto';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class PaymentsService {
    private razorpay: any;

    constructor(private prisma: PrismaService) {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_123',
            key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret123',
        });
    }

    async createRazorpayOrder(userId: string, createPaymentDto: CreatePaymentDto) {
        const { orderId } = createPaymentDto;

        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }
        if (order.customerId !== userId) {
            throw new BadRequestException('Not authorized to pay for this order');
        }
        if (order.isPaid) {
            throw new BadRequestException('Order is already paid');
        }

        try {
            const options = {
                amount: Math.round(order.totalAmount * 100), // INR paise
                currency: 'INR',
                receipt: `receipt_${order.id}`,
            };

            const razorpayOrder = await this.razorpay.orders.create(options);

            const payment = await this.prisma.payment.create({
                data: {
                    orderId: order.id,
                    amount: order.totalAmount,
                    method: PaymentMethod.UPI,
                    status: PaymentStatus.PENDING,
                    transactionId: razorpayOrder.id,
                },
            });

            return {
                razorpayOrder,
                paymentId: payment.id,
                orderId: order.id,
                amount: order.totalAmount,
            };
        } catch (error: any) {
            throw new InternalServerErrorException(error.message || 'Error creating Razorpay order');
        }
    }

    async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto) {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = verifyPaymentDto;

        const secret = process.env.RAZORPAY_KEY_SECRET || 'secret123';

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpaySignature) {
            await this.prisma.payment.updateMany({
                where: { transactionId: razorpayOrderId },
                data: { status: PaymentStatus.FAILED },
            });
            throw new BadRequestException('Invalid payment signature');
        }

        await this.prisma.$transaction(async (prisma) => {
            await prisma.payment.updateMany({
                where: { transactionId: razorpayOrderId },
                data: {
                    status: PaymentStatus.SUCCESS,
                    gatewayResponse: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
                },
            });

            await prisma.order.update({
                where: { id: orderId },
                data: { isPaid: true },
            });
        });

        return { success: true, message: 'Payment verified successfully' };
    }

    async handleWebhook(body: any, signature: string) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret';

        const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

        if (expectedSignature !== signature) {
            throw new BadRequestException('Invalid webhook signature');
        }

        const event = body.event;
        if (event === 'payment.captured' || event === 'order.paid') {
            const paymentEntity = body.payload.payment.entity;
            const rzpOrderId = paymentEntity.order_id;

            await this.prisma.$transaction(async (prisma) => {
                const result = await prisma.payment.updateMany({
                    where: { transactionId: rzpOrderId, status: { not: PaymentStatus.SUCCESS } },
                    data: { status: PaymentStatus.SUCCESS },
                });

                if (result.count > 0) {
                    const paymentRecord = await prisma.payment.findFirst({ where: { transactionId: rzpOrderId } });
                    if (paymentRecord) {
                        await prisma.order.update({
                            where: { id: paymentRecord.orderId },
                            data: { isPaid: true },
                        });
                    }
                }
            });
        } else if (event === 'payment.failed') {
            const paymentEntity = body.payload.payment.entity;
            const rzpOrderId = paymentEntity.order_id;

            await this.prisma.payment.updateMany({
                where: { transactionId: rzpOrderId },
                data: { status: PaymentStatus.FAILED },
            });
        }

        return { received: true };
    }

    // --- SAVED PAYMENT METHODS ---

    async saveMethod(userId: string, dto: CreateSavedPaymentDto) {
        if (dto.isDefault) {
            await this.prisma.savedPaymentMethod.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        return this.prisma.savedPaymentMethod.create({
            data: {
                userId,
                type: dto.type,
                displayValue: dto.displayValue,
                token: dto.token,
                isDefault: dto.isDefault || false,
            },
        });
    }

    async getSavedMethods(userId: string) {
        return this.prisma.savedPaymentMethod.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' },
        });
    }

    async removeSavedMethod(userId: string, id: string) {
        const method = await this.prisma.savedPaymentMethod.findUnique({
            where: { id },
        });

        if (!method) {
            throw new NotFoundException('Payment method not found');
        }

        if (method.userId !== userId) {
            throw new BadRequestException('Not authorized');
        }

        return this.prisma.savedPaymentMethod.delete({
            where: { id },
        });
    }
}
