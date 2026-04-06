import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { EventsModule } from '../events/events.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriverSyncProcessor } from './driver-sync.processor';

@Module({
  imports: [
    EventsModule,
    WalletsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'orders' }),
    BullModule.registerQueue({ name: 'driver-sync' }),
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService, DriverSyncProcessor],
})
export class DeliveryModule implements OnModuleInit {
  constructor(
    @InjectQueue('driver-sync') private readonly driverSyncQueue: Queue,
  ) {}

  async onModuleInit() {
    // Register a repeatable job that fires every 10 minutes
    // BullMQ deduplicates by the repeat key, so this is safe to call on every restart
    await this.driverSyncQueue.add(
      'sync-locations',
      {},
      {
        repeat: { every: 10 * 60 * 1000 }, // 10 minutes in ms
        removeOnComplete: { count: 5 },     // Keep only the last 5 completed jobs
        removeOnFail: { count: 10 },        // Keep only the last 10 failed jobs
      },
    );
  }
}
