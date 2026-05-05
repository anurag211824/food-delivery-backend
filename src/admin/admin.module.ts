import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
    imports: [NotificationsModule, CommunicationsModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
