import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [WalletsModule, EventsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule { }
