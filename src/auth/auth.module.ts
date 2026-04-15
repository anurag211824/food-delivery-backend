import { Module, OnModuleInit } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ReferralsModule } from '../referrals/referrals.module';
import { CommunicationsModule } from '../communications/communications.module';
import { CommunicationsService } from '../communications/communications.service';
import { setCommunicationsService } from '../lib/auth';

@Module({
  imports: [ReferralsModule, CommunicationsModule],
  controllers: [AuthController],
})
export class AuthModule implements OnModuleInit {
  constructor(private communicationsService: CommunicationsService) {}

  onModuleInit() {
    // Set the communications service in auth.ts so sendOTP can use it
    setCommunicationsService(this.communicationsService);
  }
}
