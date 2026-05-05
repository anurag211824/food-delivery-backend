import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from '../wallets/wallets.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';

/** Maximum number of dispatch attempts before auto-cancelling (1 attempt per minute = 20 minutes) */
const MAX_DISPATCH_ATTEMPTS = 20;

/** Maximum search radius in km for finding nearby drivers */
const MAX_RADIUS_KM = 15;

@Processor('orders')
export class OrderQueueProcessor extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(OrderQueueProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsGateway: EventsGateway,
        private readonly notificationsService: NotificationsService,
        private readonly walletsService: WalletsService,
        @InjectQueue('orders') private readonly orderQueue: Queue,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {
        super();
    }

    // ── Startup: Clean up any orders stuck in PLACED from before restart ───
    async onModuleInit() {
        try {
            const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

            const staleOrders = await this.prisma.order.findMany({
                where: {
                    status: { in: ['PLACED', 'READY'] },
                    placedAt: { lt: cutoff },
                    // Safety: Never cancel orders that have an assigned driver actively working
                    driverId: null,
                },
                include: { restaurant: true },
            });

            if (staleOrders.length === 0) return;

            this.logger.warn(`Found ${staleOrders.length} stale unassigned orders. Cleaning up...`);

            for (const order of staleOrders) {
                try {
                    const reason = 'SYSTEM_TIMEOUT: Restaurant did not respond in time (recovered on startup).';

                    await this.prisma.order.update({
                        where: { id: order.id },
                        data: { status: 'CANCELLED', cancellationReason: reason },
                    });

                    if (order.isPaid) {
                        await this.walletsService.addFunds(
                            order.customerId,
                            order.totalAmount,
                            `REFUND_AUTO_CANCEL:${order.id}`,
                        );
                        await this.prisma.refund.create({
                            data: {
                                orderId: order.id,
                                amount: order.totalAmount,
                                reason: `AUTO_CANCEL_REFUND: ${reason}`,
                                status: 'PROCESSED',
                                isAuto: true,
                            },
                        });
                    }

                    this.eventsGateway.emitOrderStatusChange(order.id, 'CANCELLED');
                    this.eventsGateway.cleanupOrderRoom(order.id);

                    this.logger.log(`Startup cleanup: cancelled stale order ${order.id} (placed ${order.placedAt.toISOString()})`);
                } catch (err) {
                    this.logger.error(`Failed to cleanup stale order ${order.id}:`, err);
                }
            }

            this.logger.log(`Startup cleanup complete. ${staleOrders.length} stale orders cancelled.`);
        } catch (err) {
            // ⚠️ DO NOT REMOVE this try/catch.
            // The Neon DB is unreachable at startup — without this, the entire NestJS
            // process crashes on boot. This allows the server to start normally and
            // serve requests even when the DB is temporarily unavailable.
            this.logger.warn(
                `[onModuleInit] Stale-order cleanup skipped — DB unreachable: ${(err as Error).message}`,
            );
        }
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

        if (job.name === 'cancel-unpaid-order') {
            const { orderId } = job.data;

            // Fetch the order to check its current status
            const order = await this.prisma.order.findUnique({
                where: { id: orderId }
            });

            if (!order) {
                this.logger.warn(`Order ${orderId} not found, skipping cancellation.`);
                return;
            }

            // Only cancel if it's still PLACED and NOT Paid.
            // (If the customer paid, isPaid will be true. If they cancelled manually, status will be CANCELLED)
            if (order.status === 'PLACED' && !order.isPaid && order.paymentMode !== 'COD') {
                await this.prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'CANCELLED',
                        cancellationReason: 'SYSTEM_TIMEOUT: Payment not received within 10 minutes.'
                    }
                });

                this.logger.log(`Order ${orderId} auto-cancelled due to payment timeout.`);
            } else {
                this.logger.debug(`Order ${orderId} status is ${order.status} and isPaid: ${order.isPaid}. No cancellation needed.`);
            }
        }

        if (job.name === 'dispatch-order') {
            await this.handleDispatchOrder(job);
        }

        if (job.name === 'check-dispatch-timeout') {
            await this.handleDispatchTimeout(job);
        }

        if (job.name === 'cancel-stale-placed-order') {
            await this.handleStalePlacedOrder(job);
        }
    }

    private async handleDispatchOrder(job: Job) {
        const { orderId, ignoredDriverIds = [], attemptCount = 0 } = job.data;
        
        // ── Guard: Check if the order is still dispatchable ──────────────────
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true }
        });

        if (!order || order.status !== 'READY' || order.driverId !== null) {
            this.logger.debug(`Order ${orderId} is no longer dispatchable.`);
            return;
        }

        // 🚀 NEW: Freshness Guard (Cancel orders that weren't picked up for 1 hour)
        const orderAgeMinutes = (Date.now() - new Date(order.placedAt).getTime()) / (1000 * 60);
        if (orderAgeMinutes > 60) {
            this.logger.warn(`Order ${orderId} is too old (${Math.round(orderAgeMinutes)} min). Auto-cancelling.`);
            await this.autoCancelOrder(order);
            return;
        }

        // ── Guard: Check if we've exceeded max attempts (20 min timeout) ─────
        if (attemptCount >= MAX_DISPATCH_ATTEMPTS) {
            this.logger.warn(`Order ${orderId} exceeded ${MAX_DISPATCH_ATTEMPTS} dispatch attempts. Auto-cancelling.`);
            await this.autoCancelOrder(order);
            return;
        }

        // ── Step 1: Use Redis GEOSEARCH to find nearest drivers ──────────────
        const restaurantLng = order.restaurant.lng;
        const restaurantLat = order.restaurant.lat;

        let nearbyDriverIds: string[];
        try {
            // GEOSEARCH returns member names (userId) sorted by distance ASC
            // We fetch up to 10 candidates to filter out ignored drivers
            nearbyDriverIds = await this.redis.geosearch(
                'driver_locations',
                'FROMLONLAT', restaurantLng, restaurantLat,
                'BYRADIUS', MAX_RADIUS_KM, 'km',
                'ASC',
                'COUNT', 10,
            ) as string[];
        } catch (err) {
            this.logger.error(`Redis GEOSEARCH failed for order ${orderId}:`, err);
            // Fallback: retry in 1 minute
            await this.scheduleRetry(orderId, ignoredDriverIds, attemptCount);
            return;
        }

        // Filter out ignored drivers (already pinged/declined)
        let candidateIds = nearbyDriverIds.filter(id => !ignoredDriverIds.includes(id));

        // 🚀 NEW: Filter out drivers who explicitly declined this order via the REST API
        if (candidateIds.length > 0) {
            const declineChecks = await Promise.all(
                candidateIds.map(id => this.redis.sismember(`declined_orders:${id}`, orderId))
            );
            candidateIds = candidateIds.filter((_, index) => declineChecks[index] === 0);
        }

        if (candidateIds.length === 0) {
            this.logger.warn(
                `No available drivers within ${MAX_RADIUS_KM}km for order ${orderId} (attempt ${attemptCount + 1}/${MAX_DISPATCH_ATTEMPTS}). Re-trying in 1 minute.`
            );
            // Clear ignored list on retry so previously skipped drivers get another chance
            await this.orderQueue.add(
                'dispatch-order',
                { orderId, ignoredDriverIds: [], attemptCount: attemptCount + 1 },
                { jobId: `dispatch-${orderId}-${attemptCount + 1}`, delay: 60000 },
            );
            return;
        }

        // ── Step 2: Pick the closest candidate & get their distance ──────────
        const closestDriverId = candidateIds[0];

        // Get the actual distance for logging & the offer payload
        const geoPos = await this.redis.geopos('driver_locations', closestDriverId);
        let distanceKm = 0;
        if (geoPos && geoPos[0]) {
            const [driverLng, driverLat] = geoPos[0];
            distanceKm = this.haversine(
                restaurantLat, restaurantLng,
                parseFloat(driverLat), parseFloat(driverLng),
            );
        }

        // ── Step 3: Verify the driver is still ONLINE in the database ────────
        // (Redis geo index is eventually consistent; a driver may have gone offline
        //  between the last ZREM and this lookup)
        const driverProfile = await this.prisma.driverProfile.findFirst({
            where: {
                userId: closestDriverId,
                status: 'ONLINE',
            },
        });

        if (!driverProfile) {
            this.logger.debug(`Driver ${closestDriverId} is no longer ONLINE. Removing from geo index and retrying.`);
            // Clean up stale entry in Redis
            await this.redis.zrem('driver_locations', closestDriverId);
            // Retry immediately (reuse attempt count, but new jobId)
            await this.orderQueue.add(
                'dispatch-order',
                { orderId, ignoredDriverIds: [...ignoredDriverIds, closestDriverId], attemptCount },
                { jobId: `dispatch-${orderId}-${attemptCount}-retry`, delay: 0 },
            );
            return;
        }

        // ── Step 4: Send the offer to the driver ─────────────────────────────
        this.logger.log(`Dispatching order ${orderId} to driver ${closestDriverId} (${distanceKm.toFixed(2)}km away) [attempt ${attemptCount + 1}]`);

        const earning = order.deliveryCharge + order.driverTip;
        const offerExpiresAt = Date.now() + 45_000;

        // Send WebSocket directly to the specific driver's private room
        this.eventsGateway.emitOrderOffered(closestDriverId, {
            orderId: order.id,
            restaurantName: order.restaurant.name,
            distanceKm: distanceKm.toFixed(2),
            earning: earning,
            expiresInSeconds: 45,
            offerExpiresAt
        });

        // Send Push Notification 
        this.notificationsService.send(
            closestDriverId,
            'New Delivery Available! 🛵',
            `${order.restaurant.name} - Earn ₹${earning}. Tap to accept within 45s.`,
            'ORDER_OFFER',
            {
                orderId: order.id,
                restaurantName: order.restaurant.name,
                distanceKm: Number(distanceKm.toFixed(2)),
                earning,
                offerExpiresAt,
            }
        ).catch(e => this.logger.error('Failed push notification', e));

        // Enqueue timeout check after 45 seconds
        await this.orderQueue.add(
            'check-dispatch-timeout',
            {
                orderId: order.id,
                pingedDriverId: closestDriverId,
                ignoredDriverIds: [...ignoredDriverIds, closestDriverId],
                attemptCount,
            },
            { delay: 45000 }
        );
    }

    private async handleDispatchTimeout(job: Job) {
        const { orderId, pingedDriverId, ignoredDriverIds, attemptCount = 0 } = job.data;
        
        const order = await this.prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order || order.status !== 'READY' || order.driverId !== null) {
            this.logger.debug(`Timeout task: Order ${orderId} was already accepted or changed.`);
            return;
        }

        // Tell the timed-out driver's app to dismiss the offer popup
        this.eventsGateway.emitOrderOfferExpired(pingedDriverId, orderId);

        this.logger.log(`Order ${orderId} was not accepted by ${pingedDriverId}. Re-dispatching.`);
        
        await this.orderQueue.add(
            'dispatch-order',
            { orderId, ignoredDriverIds, attemptCount },
            { jobId: `dispatch-${orderId}-${attemptCount}-retry`, delay: 0 } 
        );
    }

    // ── Handler: Cancel orders the restaurant never accepted ──────────────
    private async handleStalePlacedOrder(job: Job) {
        const { orderId } = job.data;

        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true },
        });

        if (!order) {
            this.logger.debug(`Stale-check: Order ${orderId} not found, skipping.`);
            return;
        }

        // Only cancel if it's STILL in PLACED (restaurant never accepted/refused)
        if (order.status !== 'PLACED') {
            this.logger.debug(`Stale-check: Order ${orderId} is now ${order.status}, no action needed.`);
            return;
        }

        const reason = 'SYSTEM_TIMEOUT: Restaurant did not respond within 10 minutes.';

        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                cancellationReason: reason,
            },
        });

        // Auto-refund if order was paid (wallet, UPI, card, etc.)
        if (order.isPaid) {
            await this.walletsService.addFunds(
                order.customerId,
                order.totalAmount,
                `REFUND_AUTO_CANCEL:${order.id}`,
            );
            await this.prisma.refund.create({
                data: {
                    orderId: order.id,
                    amount: order.totalAmount,
                    reason: `AUTO_CANCEL_REFUND: ${reason}`,
                    status: 'PROCESSED',
                    isAuto: true,
                },
            });
        }

        // Real-time + Push notifications
        this.eventsGateway.emitOrderStatusChange(order.id, 'CANCELLED');
        this.eventsGateway.cleanupOrderRoom(order.id);

        this.notificationsService.send(
            order.customerId,
            'Order Cancelled ❌',
            'The restaurant didn\'t respond to your order in time. Any payment has been refunded to your wallet.',
            'ORDER_UPDATE',
            { orderId: order.id, status: 'CANCELLED' },
        ).catch(e => this.logger.error('Failed to send stale-order cancellation notification', e));

        this.notificationsService.send(
            order.restaurant.managerId,
            'Missed Order ⚠️',
            `Order #${order.id.slice(-6)} was auto-cancelled because it wasn't accepted within 10 minutes.`,
            'ORDER_UPDATE',
            { orderId: order.id, status: 'CANCELLED' },
        ).catch(e => this.logger.error('Failed to send restaurant missed-order notification', e));

        this.logger.log(`Order ${orderId} auto-cancelled: restaurant did not respond within 10 minutes.`);
    }

    // ── Helper: Schedule a retry with incremented attempt count ───────────
    private async scheduleRetry(orderId: string, ignoredDriverIds: string[], currentAttempt: number) {
        await this.orderQueue.add(
            'dispatch-order',
            { orderId, ignoredDriverIds, attemptCount: currentAttempt + 1 },
            { jobId: `dispatch-${orderId}-${currentAttempt + 1}`, delay: 60000 },
        );
    }

    // ── Helper: Auto-cancel an order that couldn't find a driver ──────────
    private async autoCancelOrder(order: any) {
        const reason = `SYSTEM_TIMEOUT: No delivery partner found within ${MAX_DISPATCH_ATTEMPTS} minutes.`;

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'CANCELLED',
                cancellationReason: reason,
            },
        });

        // Auto-refund to internal wallet if the order was paid (regardless of payment mode)
        // This provides 'Instant Credit' so users can try again immediately.
        if (order.isPaid) {
            await this.walletsService.addFunds(
                order.customerId,
                order.totalAmount,
                `REFUND_AUTO_CANCEL:${order.id}`,
            );
            await this.prisma.refund.create({
                data: {
                    orderId: order.id,
                    amount: order.totalAmount,
                    reason: `AUTO_CANCEL_REFUND: ${reason}`,
                    status: 'PROCESSED',
                    isAuto: true,
                },
            });
        }

        // Real-time notification
        this.eventsGateway.emitOrderStatusChange(order.id, 'CANCELLED');
        this.eventsGateway.cleanupOrderRoom(order.id);

        // Push notification to customer
        this.notificationsService.send(
            order.customerId,
            'Order Cancelled ❌',
            'We couldn\'t find a delivery partner for your order. Any payment has been refunded to your wallet.',
            'ORDER_UPDATE',
            { orderId: order.id, status: 'CANCELLED' },
        ).catch(e => this.logger.error('Failed to send auto-cancel push notification', e));

        // Push notification to restaurant manager
        this.notificationsService.send(
            order.restaurant.managerId,
            'Order Auto-Cancelled ⚠️',
            `Order #${order.id.slice(-6)} was cancelled because no delivery partner was available.`,
            'ORDER_UPDATE',
            { orderId: order.id, status: 'CANCELLED' },
        ).catch(e => this.logger.error('Failed to send restaurant auto-cancel notification', e));

        this.logger.log(`Order ${order.id} auto-cancelled after ${MAX_DISPATCH_ATTEMPTS} failed dispatch attempts.`);
    }

    // ── Haversine distance calculation (used for logging/display only) ────
    private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
