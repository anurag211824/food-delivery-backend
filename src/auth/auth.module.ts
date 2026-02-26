import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [ReferralsModule],
  controllers: [AuthController],
})
export class AuthModule { }
