import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { EventsModule } from '../events/events.module';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WalletsModule, EventsModule, CouponsModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule { }
