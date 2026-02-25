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

@Module({
  imports: [AuthModule, RestaurantsModule, PrismaModule, MenuItemsModule, MenuCategoriesModule, AddressesModule, OrdersModule, DeliveryModule, PaymentsModule, WalletsModule],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule { }
