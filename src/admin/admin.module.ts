import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsModule } from '../communications/communications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
    imports: [NotificationsModule, CommunicationsModule, WalletsModule, PayoutsModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }

