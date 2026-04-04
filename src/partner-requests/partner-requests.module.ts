import { Module } from '@nestjs/common';
import { PartnerRequestsController } from './partner-requests.controller';
import { PartnerRequestsService } from './partner-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [PartnerRequestsController],
    providers: [PartnerRequestsService],
})
export class PartnerRequestsModule { }
