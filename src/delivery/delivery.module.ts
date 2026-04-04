import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { EventsModule } from '../events/events.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    EventsModule,
    WalletsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'orders' }),
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule { }
