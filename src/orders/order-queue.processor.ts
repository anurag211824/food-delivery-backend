import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Processor('orders')
export class OrderQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(OrderQueueProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsGateway: EventsGateway,
        private readonly notificationsService: NotificationsService,
        @InjectQueue('orders') private readonly orderQueue: Queue
    ) {
        super();
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
    }

    private async handleDispatchOrder(job: Job) {
        const { orderId, ignoredDriverIds = [] } = job.data;
        
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: true }
        });

        if (!order || order.status !== 'READY' || order.driverId !== null) {
            this.logger.debug(`Order ${orderId} is no longer dispatchable.`);
            return;
        }

        // Find ONLINE, AVAILABLE drivers
        const activeDrivers = await this.prisma.driverProfile.findMany({
            where: {
                status: 'ONLINE',
                userId: { notIn: ignoredDriverIds },
                currentLat: { not: null },
                currentLng: { not: null }
            }
        });

        if (activeDrivers.length === 0) {
            this.logger.warn(`No available drivers found for order ${orderId}. Re-trying in 1 minute.`);
            // Delay 1 min and clear ignored drivers to see if someone came online
            await this.orderQueue.add('dispatch-order', { orderId, ignoredDriverIds: [] }, { delay: 60000 });
            return;
        }

        const restaurantLat = order.restaurant.lat;
        const restaurantLng = order.restaurant.lng;

        // Calculate distance via straight line
        let closestDriver = activeDrivers[0];
        let minDistance = Infinity;

        for (const driver of activeDrivers) {
            const R = 6371; // km
            const dLat = (restaurantLat - driver.currentLat!) * Math.PI / 180;
            const dLon = (restaurantLng - driver.currentLng!) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(restaurantLat * Math.PI / 180) * Math.cos(driver.currentLat! * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            if (distance < minDistance) {
                minDistance = distance;
                closestDriver = driver;
            }
        }

        if (minDistance > 15) { // 15km max
            this.logger.warn(`Closest driver is ${minDistance.toFixed(2)}km away. Skipping dispatch.`);
            return;
        }

        this.logger.log(`Dispatching order ${orderId} to driver ${closestDriver.userId} (${minDistance.toFixed(2)}km away)`);

        const earning = order.deliveryCharge + order.driverTip;

        // Send WebSocket directly to the specific driver's private room
        this.eventsGateway.emitOrderOffered(closestDriver.userId, {
            orderId: order.id,
            restaurantName: order.restaurant.name,
            distanceKm: minDistance.toFixed(2),
            earning: earning,
            expiresInSeconds: 45
        });

        // Send Push Notification 
        this.notificationsService.send(
            closestDriver.userId,
            'New Delivery Available! 🛵',
            `${order.restaurant.name} - Earn ₹${earning}. Tap to accept within 45s.`,
            'ORDER_OFFER',
            { orderId: order.id }
        ).catch(e => this.logger.error('Failed push notification', e));

        // Enqueue timeout check after 45 seconds
        await this.orderQueue.add(
            'check-dispatch-timeout',
            {
                orderId: order.id,
                pingedDriverId: closestDriver.userId,
                ignoredDriverIds: [...ignoredDriverIds, closestDriver.userId]
            },
            { delay: 45000 }
        );
    }

    private async handleDispatchTimeout(job: Job) {
        const { orderId, pingedDriverId, ignoredDriverIds } = job.data;
        
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
            { orderId, ignoredDriverIds },
            { delay: 0 } 
        );
    }
}
