import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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
  ) {}

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
      where: { referralCode: dto.referralCode },
    });

    if (!referrer) {
      throw new NotFoundException('Invalid referral code.');
    }

    // Read live policy from DB
    const policy = await this.appConfigService.getReferralPolicy();

    if (!policy.enabled) {
      throw new BadRequestException(
        'The referral program is currently disabled.',
      );
    }

    // ─── Phase 1: Link the users atomically (fast, no wallet calls inside) ────
    await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    // ─── Phase 2: Distribute rewards OUTSIDE the transaction ─────────────────
    // Each addFunds() call runs its own independent transaction — no nesting.
    if (policy.referrerReward > 0) {
      await this.walletsService.addFunds(
        referrer.id,
        policy.referrerReward,
        `REFERRAL_BONUS_FOR_INVITING_${userId}`,
        `Referral bonus of ₹${policy.referrerReward} for inviting a friend`,
      );
    }

    if (policy.referredReward > 0) {
      await this.walletsService.addFunds(
        userId,
        policy.referredReward,
        `REFERRAL_BONUS_WELCOME`,
        `Welcome bonus of ₹${policy.referredReward} for joining via referral`,
      );
    }

    return {
      success: true,
      message: 'Referral applied successfully. Rewards have been distributed!',
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
    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
    });
    if (!newUser) return;

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
    const finalUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
    });
    if (finalUser?.referredById !== referrer.id) return;

    // Credit the inviter and the invitee using independent transactions
    // Idempotency: Use unique transaction types and check for existing credits
    if (policy.referrerReward > 0) {
      const referrerReason = `REFERRAL_BONUS_FOR_INVITING_${newUserId}`;
      const existingReferrerReward =
        await this.prisma.walletTransaction.findFirst({
          where: { wallet: { userId: referrer.id }, type: referrerReason },
        });
      if (!existingReferrerReward) {
        await this.walletsService.addFunds(
          referrer.id,
          policy.referrerReward,
          referrerReason,
          `Referral bonus of ₹${policy.referrerReward} for inviting a friend`,
        );
      }
    }
    if (policy.referredReward > 0) {
      const referredReason = `REFERRAL_BONUS_WELCOME_${newUserId}`;
      const existingReferredReward =
        await this.prisma.walletTransaction.findFirst({
          where: { wallet: { userId: newUserId }, type: referredReason },
        });
      if (!existingReferredReward) {
        await this.walletsService.addFunds(
          newUserId,
          policy.referredReward,
          referredReason,
          `Welcome bonus of ₹${policy.referredReward} for joining via referral`,
        );
      }
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
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Use live policy for earnings estimate instead of hardcoded value
    const policy = await this.appConfigService.getReferralPolicy();

    return {
      myCode: user.referralCode,
      totalReferrals: user.referrals.length,
      earningsEst: user.referrals.length * policy.referrerReward,
      referrals: user.referrals,
    };
  }
}
