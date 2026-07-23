import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Referrals & Rewards')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.CUSTOMER) // Only customers can use referrals
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post('apply')
  @ApiOperation({
    summary: "Apply a friend's referral code for a wallet reward",
  })
  @ApiResponse({
    status: 200,
    description: 'Code successfully applied, both users rewarded.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid code or trying to apply own code',
  })
  @ApiResponse({ status: 409, description: 'Already used a referral code' })
  async applyReferral(
    @Req() req: AuthenticatedRequest,
    @Body() applyReferralDto: ApplyReferralDto,
  ) {
    return this.referralsService.applyReferral(req.user.id, applyReferralDto);
  }

  @Get('my-stats')
  @ApiOperation({
    summary: 'Get your unique code and see how many people you referred',
  })
  @ApiResponse({ status: 200, description: 'Referral stats and code' })
  async getMyReferrals(@Req() req: AuthenticatedRequest) {
    return this.referralsService.getMyReferrals(req.user.id);
  }
}
