import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [WalletsModule, AppConfigModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule { }
