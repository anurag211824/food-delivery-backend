import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateSavedPaymentDto } from './dto/create-saved-payment.dto';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private razorpay: any;

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private eventsGateway: EventsGateway,
        private notificationsService: NotificationsService,
    ) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            console.warn('[PaymentsService] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set. Payments will fail.');
        }
        this.razorpay = new Razorpay({
            key_id: keyId || 'rzp_test_placeholder',
            key_secret: keySecret || 'placeholder_secret',
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
            return {
                isPaid: true,
                orderId: order.id,
            };
        }

        try {
            // Check if there is already a pending payment for this order
            const existingPayment = await this.prisma.payment.findFirst({
                where: {
                    orderId: order.id,
                    status: PaymentStatus.PENDING,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (existingPayment) {
                try {
                    const razorpayOrder = await this.razorpay.orders.fetch(existingPayment.transactionId);
                    return {
                        razorpayOrder,
                        paymentId: existingPayment.id,
                        orderId: order.id,
                        amount: order.totalAmount,
                    };
                } catch (err) {
                    // Fallback to creating a new order if fetch fails
                }
            }

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
            this.logger.error(`Failed to create Razorpay order for order ${orderId}`, { userId, orderId, error: error.message });
            throw new InternalServerErrorException(error.message || 'Error creating Razorpay order');
        }
    }

    async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto) {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = verifyPaymentDto;

        // Security: Verify the order belongs to the requesting user
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundException('Order not found');
        }
        if (order.customerId !== userId) {
            throw new BadRequestException('You are not authorized to pay for this order.');
        }
        if (order.isPaid) {
            throw new BadRequestException('Order is already paid.');
        }

        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            throw new InternalServerErrorException('Payment verification is not configured. Contact support.');
        }

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

        // ─── Notify the restaurant manager of the paid order ───────────
        try {
            const orderWithRestaurant = await this.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    restaurant: true,
                    store: true,
                    items: true,
                },
            });

            if (orderWithRestaurant) {
                const merchantManagerId = orderWithRestaurant.restaurant?.managerId ?? orderWithRestaurant.store?.managerId;
                const merchantEntityId = orderWithRestaurant.restaurantId ?? orderWithRestaurant.storeId;

                if (merchantManagerId) {
                    this.notificationsService.send(
                        merchantManagerId,
                        '🔔 New Order!',
                        `A new order of ₹${orderWithRestaurant.totalAmount} has been placed.`,
                        'ORDER_UPDATE',
                        { orderId: orderWithRestaurant.id },
                    ).catch(e => this.logger.error(`Failed to send push notification to merchant for order ${orderWithRestaurant.id}`, e));
                }

                if (merchantEntityId && orderWithRestaurant.restaurantId) {
                    this.eventsGateway.emitNewOrderToRestaurant(merchantEntityId, {
                        orderId: orderWithRestaurant.id,
                        totalAmount: orderWithRestaurant.totalAmount,
                        itemCount: orderWithRestaurant.items.length,
                        paymentMode: orderWithRestaurant.paymentMode,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        } catch (error) {
            this.logger.error(`Error notifying restaurant manager after payment verification:`, error);
        }

        return { success: true, message: 'Payment verified successfully' };
    }

    async handleWebhook(body: any, signature: string, eventId?: string) {
        if (eventId) {
            const isProcessed = await this.cacheManager.get(`webhook_${eventId}`);
            if (isProcessed) {
                return { success: true, message: 'Webhook already processed' };
            }
        }

        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            throw new BadRequestException('Webhook verification is not configured.');
        }

        const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

        if (expectedSignature !== signature) {
            throw new BadRequestException('Invalid webhook signature');
        }

        const event = body.event;
        if (event === 'payment.captured' || event === 'order.paid') {
            const paymentEntity = body.payload.payment.entity;
            const rzpOrderId = paymentEntity.order_id;
            let shouldNotify = false;
            let orderIdToNotify = '';

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
                        shouldNotify = true;
                        orderIdToNotify = paymentRecord.orderId;
                    }
                }
            });

            if (shouldNotify && orderIdToNotify) {
                try {
                    const orderWithRestaurant = await this.prisma.order.findUnique({
                        where: { id: orderIdToNotify },
                        include: {
                            restaurant: true,
                            store: true,
                            items: true,
                        },
                    });

                    if (orderWithRestaurant) {
                        const merchantManagerId = orderWithRestaurant.restaurant?.managerId ?? orderWithRestaurant.store?.managerId;
                        const merchantEntityId = orderWithRestaurant.restaurantId ?? orderWithRestaurant.storeId;

                        if (merchantManagerId) {
                            this.notificationsService.send(
                                merchantManagerId,
                                '🔔 New Order!',
                                `A new order of ₹${orderWithRestaurant.totalAmount} has been placed.`,
                                'ORDER_UPDATE',
                                { orderId: orderWithRestaurant.id },
                            ).catch(e => this.logger.error(`Failed to send push notification to merchant via webhook for order ${orderWithRestaurant.id}`, e));
                        }

                        if (merchantEntityId && orderWithRestaurant.restaurantId) {
                            this.eventsGateway.emitNewOrderToRestaurant(merchantEntityId, {
                                orderId: orderWithRestaurant.id,
                                totalAmount: orderWithRestaurant.totalAmount,
                                itemCount: orderWithRestaurant.items.length,
                                paymentMode: orderWithRestaurant.paymentMode,
                                timestamp: new Date().toISOString(),
                            });
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error in webhook notifying restaurant manager for order ${orderIdToNotify}:`, error);
                }
            }
        } else if (event === 'payment.failed') {
            const paymentEntity = body.payload.payment.entity;
            const rzpOrderId = paymentEntity.order_id;

            await this.prisma.payment.updateMany({
                where: { transactionId: rzpOrderId },
                data: { status: PaymentStatus.FAILED },
            });
        }

        if (eventId) {
            // Cache for 24 hours to prevent replays
            await this.cacheManager.set(`webhook_${eventId}`, true, 86400000);
        }

        return { success: true };
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
