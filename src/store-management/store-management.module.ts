import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StoreManagementController } from './store-management.controller';
import { StoreManagementService } from './store-management.service';

@Module({
  imports: [PrismaModule, EventsModule, NotificationsModule],
  controllers: [StoreManagementController],
  providers: [StoreManagementService],
  exports: [StoreManagementService],
})
export class StoreManagementModule {}
