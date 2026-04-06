import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Periodic safety-net that cancels "zombie" orders — orders stuck in
 * non-terminal statuses for far longer than any real delivery should take.
 *
 * Runs every hour and catches orders in ANY active status that are
 * older than the configured thresholds.
 */
@Injectable()
export class OrderCleanupCron {
    private readonly logger = new Logger(OrderCleanupCron.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly walletsService: WalletsService,
        private readonly eventsGateway: EventsGateway,
        private readonly notificationsService: NotificationsService,
    ) {}

    /**
     * Runs every hour. Finds and cancels orders stuck in active statuses
     * beyond reasonable time limits:
     *
     *  PLACED          → should never survive > 10 min (handled by queue job too)
     *  ACCEPTED        → restaurant accepted but never started preparing (> 1 hour)
     *  PREPARING       → restaurant never marked ready (> 2 hours)
     *  READY           → dispatch timeout should handle this, but safety net (> 2 hours)
     *  PICKED_UP       → driver picked up but never delivered (> 3 hours)
     *  ON_THE_WAY      → driver on the way but never delivered (> 3 hours)
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleZombieOrders() {
        this.logger.log('Running zombie order cleanup...');

        const now = Date.now();

        // Define max age (in ms) for each active status
        const statusThresholds: { status: string; maxAgeMs: number; label: string }[] = [
            { status: 'PLACED',    maxAgeMs: 30 * 60 * 1000,     label: '30 minutes' },   // extra safety net
            { status: 'ACCEPTED',  maxAgeMs: 1 * 60 * 60 * 1000, label: '1 hour' },
            { status: 'PREPARING', maxAgeMs: 2 * 60 * 60 * 1000, label: '2 hours' },
            { status: 'READY',     maxAgeMs: 2 * 60 * 60 * 1000, label: '2 hours' },
            { status: 'PICKED_UP', maxAgeMs: 3 * 60 * 60 * 1000, label: '3 hours' },
            { status: 'ON_THE_WAY', maxAgeMs: 3 * 60 * 60 * 1000, label: '3 hours' },
        ];

        let totalCancelled = 0;

        for (const { status, maxAgeMs, label } of statusThresholds) {
            const cutoff = new Date(now - maxAgeMs);

            const zombieOrders = await this.prisma.order.findMany({
                where: {
                    status: status as any,
                    placedAt: { lt: cutoff },
                },
                include: { restaurant: true },
            });

            if (zombieOrders.length === 0) continue;

            this.logger.warn(
                `Found ${zombieOrders.length} zombie orders in "${status}" older than ${label}.`,
            );

            for (const order of zombieOrders) {
                try {
                    const reason = `SYSTEM_CLEANUP: Order stuck in "${status}" for over ${label}. Auto-cancelled by scheduled cleanup.`;

                    await this.prisma.order.update({
                        where: { id: order.id },
                        data: { status: 'CANCELLED', cancellationReason: reason },
                    });

                    // Auto-refund if the order was paid
                    if (order.isPaid) {
                        await this.walletsService.addFunds(
                            order.customerId,
                            order.totalAmount,
                            `REFUND_CLEANUP:${order.id}`,
                        );
                        await this.prisma.refund.create({
                            data: {
                                orderId: order.id,
                                amount: order.totalAmount,
                                reason: `AUTO_CLEANUP_REFUND: ${reason}`,
                                status: 'PROCESSED',
                                isAuto: true,
                            },
                        });
                    }

                    // Real-time cleanup
                    this.eventsGateway.emitOrderStatusChange(order.id, 'CANCELLED');
                    this.eventsGateway.cleanupOrderRoom(order.id);

                    // Notify customer
                    this.notificationsService.send(
                        order.customerId,
                        'Order Cancelled ❌',
                        `Your order was automatically cancelled because it was stuck in "${status}" for too long. Any payment has been refunded.`,
                        'ORDER_UPDATE',
                        { orderId: order.id, status: 'CANCELLED' },
                    ).catch(e => this.logger.error('Cleanup notification failed', e));

                    // Notify restaurant
                    if (order.restaurant?.managerId) {
                        this.notificationsService.send(
                            order.restaurant.managerId,
                            'Order Auto-Cancelled ⚠️',
                            `Order #${order.id.slice(-6)} was stuck in "${status}" and has been auto-cancelled by system cleanup.`,
                            'ORDER_UPDATE',
                            { orderId: order.id, status: 'CANCELLED' },
                        ).catch(e => this.logger.error('Cleanup restaurant notification failed', e));
                    }

                    totalCancelled++;
                    this.logger.log(`Cleanup: cancelled zombie order ${order.id} (status: ${status}, placed: ${order.placedAt.toISOString()})`);
                } catch (err) {
                    this.logger.error(`Failed to cleanup zombie order ${order.id}:`, err);
                }
            }
        }

        if (totalCancelled > 0) {
            this.logger.warn(`Zombie order cleanup complete. ${totalCancelled} orders cancelled.`);
        } else {
            this.logger.log('Zombie order cleanup complete. No zombie orders found.');
        }
    }
}
