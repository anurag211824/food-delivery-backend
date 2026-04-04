import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';

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
import { CouponsModule } from './coupons/coupons.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

function getRedisOptions(redisUrl?: string): RedisOptions {
  if (!redisUrl) {
    return {
      host: '127.0.0.1',
      port: 6379,
    };
  }

  const url = new URL(redisUrl);
  const shouldUseTls =
    url.protocol === 'rediss:' || url.hostname.endsWith('.upstash.io');

  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    tls: shouldUseTls ? {} : undefined,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(getRedisOptions(configService.get<string>('REDIS_URL')))
        ),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          connection: {
            ...getRedisOptions(configService.get<string>('REDIS_URL')),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
        return {
          // store expects a keyv adapter or similar in v6; using createKeyv is correct for @keyv/redis
          store: createKeyv(redisUrl),
          ttl: 300000, // 5 minutes global default
        };
      },
    }),
    AuthModule, RestaurantsModule, PrismaModule, MenuItemsModule, MenuCategoriesModule, AddressesModule, OrdersModule, DeliveryModule, PaymentsModule, WalletsModule, EventsModule, ReviewsModule, ReferralsModule, AppConfigModule, AdminModule, PartnerRequestsModule, CouponsModule, NotificationsModule],
  controllers: [AppController],
  providers: [
    AppService, 
    EventsGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    }
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}

