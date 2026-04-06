import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { EventsModule } from '../events/events.module';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderQueueProcessor } from './order-queue.processor';
import { OrderCleanupCron } from './order-cleanup.cron';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
    }),
    WalletsModule, EventsModule, CouponsModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderQueueProcessor, OrderCleanupCron],
})
export class OrdersModule { }
