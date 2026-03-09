import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { EventsModule } from '../events/events.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [EventsModule, WalletsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule { }
