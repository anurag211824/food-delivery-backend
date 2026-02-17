import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';

@Module({
  imports: [AuthModule, RestaurantsModule, PrismaModule, MenuItemsModule, MenuCategoriesModule],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule { }
