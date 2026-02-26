import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly appConfigService: AppConfigService,
  ) { }

  async applyReferral(userId: string, dto: ApplyReferralDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.referredById) {
      throw new ConflictException('You have already applied a referral code.');
    }

    if (user.referralCode === dto.referralCode) {
      throw new BadRequestException('You cannot use your own referral code.');
    }

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: dto.referralCode }
    });

    if (!referrer) {
      throw new NotFoundException('Invalid referral code.');
    }

    // Read live policy from DB
    const policy = await this.appConfigService.getReferralPolicy();

    if (!policy.enabled) {
      throw new BadRequestException('The referral program is currently disabled.');
    }

    // ─── Phase 1: Link the users atomically (fast, no wallet calls inside) ────
    await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id }
    });

    // ─── Phase 2: Distribute rewards OUTSIDE the transaction ─────────────────
    // Each addFunds() call runs its own independent transaction — no nesting.
    if (policy.referrerReward > 0) {
      await this.walletsService.addFunds(
        referrer.id,
        policy.referrerReward,
        `REFERRAL_BONUS_FOR_INVITING_${userId}`
      );
    }

    if (policy.referredReward > 0) {
      await this.walletsService.addFunds(
        userId,
        policy.referredReward,
        `REFERRAL_BONUS_WELCOME`
      );
    }

    return {
      success: true,
      message: 'Referral applied successfully. Rewards have been distributed!'
    };
  }

  /**
   * Internal method called automatically during signup.
   * Safe to call even if the DB link was already set by Better Auth.
   * It ONLY distributes wallet rewards and never throws on conflicts.
   */
  async rewardReferral(newUserId: string, referralCode: string) {
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
    });

    if (!referrer || referrer.id === newUserId) {
      return; // Invalid code or self-referral — silently bail
    }

    // Ensure we only ever reward once per user by checking the DB link
    const newUser = await this.prisma.user.findUnique({ where: { id: newUserId } });
    if (!newUser) return;

    const REFERRER_REWARD = 100;
    const REFERRED_REWARD = 50;

    // Read live policy from DB — never throw, this is an internal silent method
    const policy = await this.appConfigService.getReferralPolicy();

    if (!policy.enabled) return; // Referral program is off, skip silently

    // Link users if not already linked (handles both email + phone signup flows)
    if (!newUser.referredById) {
      await this.prisma.user.update({
        where: { id: newUserId },
        data: { referredById: referrer.id },
      });
    }

    // Only pay out if the referredById matches this referrer (prevents double rewards)
    const finalUser = await this.prisma.user.findUnique({ where: { id: newUserId } });
    if (finalUser?.referredById !== referrer.id) return;

    // Credit the inviter and the invitee using independent transactions
    if (policy.referrerReward > 0) {
      await this.walletsService.addFunds(referrer.id, policy.referrerReward, `REFERRAL_BONUS_FOR_INVITING_${newUserId}`);
    }
    if (policy.referredReward > 0) {
      await this.walletsService.addFunds(newUserId, policy.referredReward, `REFERRAL_BONUS_WELCOME`);
    }
  }

  async getMyReferrals(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referrals: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          }
        }
      }
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      myCode: user.referralCode,
      totalReferrals: user.referrals.length,
      earningsEst: user.referrals.length * 100, // Roughly 100 per referral
      referrals: user.referrals
    };
  }
}
