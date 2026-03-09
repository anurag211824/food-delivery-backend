import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('orders')
export class OrderQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(OrderQueueProcessor.name);

    constructor(private readonly prisma: PrismaService) {
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
    }
}
