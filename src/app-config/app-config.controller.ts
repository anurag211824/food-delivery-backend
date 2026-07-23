import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { UpdateReferralPolicyDto } from './dto/update-referral-policy.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin — App Config')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Controller('admin/config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('referral')
  @ApiOperation({ summary: 'Get current referral policy' })
  @ApiResponse({
    status: 200,
    description: 'Returns current referral policy settings',
  })
  getReferralPolicy() {
    return this.appConfigService.getReferralPolicy();
  }

  @Patch('referral')
  @ApiOperation({
    summary: 'Update referral policy (enable/disable or change reward amounts)',
  })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  async updateReferralPolicy(@Body() dto: UpdateReferralPolicyDto) {
    const updates: Promise<any>[] = [];

    if (dto.enabled !== undefined) {
      updates.push(
        this.appConfigService.setConfig(
          'referral_enabled',
          String(dto.enabled),
        ),
      );
    }
    if (dto.referrerReward !== undefined) {
      updates.push(
        this.appConfigService.setConfig(
          'referrer_reward',
          String(dto.referrerReward),
        ),
      );
    }
    if (dto.referredReward !== undefined) {
      updates.push(
        this.appConfigService.setConfig(
          'referred_reward',
          String(dto.referredReward),
        ),
      );
    }

    await Promise.all(updates);
    return this.appConfigService.getReferralPolicy(); // Return new state
  }

  @Post('referral/seed-defaults')
  @ApiOperation({
    summary:
      'Reset referral policy to default values (only creates missing rows)',
  })
  @ApiResponse({ status: 201, description: 'Defaults seeded' })
  seedDefaults() {
    return this.appConfigService.seedDefaults();
  }
}
