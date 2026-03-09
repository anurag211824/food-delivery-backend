import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';
import { AddressesModule } from './addresses/addresses.module';
import { OrdersModule } from './orders/orders.module';
import { DeliveryModule } from './delivery/delivery.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletsModule } from './wallets/wallets.module';
import { EventsGateway } from './events/events.gateway';
import { EventsModule } from './events/events.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AppConfigModule } from './app-config/app-config.module';
import { AdminModule } from './admin/admin.module';
import { PartnerRequestsModule } from './partner-requests/partner-requests.module';

@Module({
  imports: [AuthModule, RestaurantsModule, PrismaModule, MenuItemsModule, MenuCategoriesModule, AddressesModule, OrdersModule, DeliveryModule, PaymentsModule, WalletsModule, EventsModule, ReviewsModule, ReferralsModule, AppConfigModule, AdminModule, PartnerRequestsModule],
  controllers: [AppController, TestController],
  providers: [AppService, EventsGateway],
})
export class AppModule { }
