import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReferralPolicy {
    enabled: boolean;
    referrerReward: number;   // Rs amount to the person who shared the code
    referredReward: number;   // Rs welcome bonus for the new user
}

// Default fallback values if DB has no config yet
const DEFAULTS: ReferralPolicy = {
    enabled: true,
    referrerReward: 100,
    referredReward: 50,
};

@Injectable()
export class AppConfigService {
    constructor(private readonly prisma: PrismaService) { }

    async getReferralPolicy(): Promise<ReferralPolicy> {
        const rows = await this.prisma.appConfig.findMany({
            where: {
                key: { in: ['referral_enabled', 'referrer_reward', 'referred_reward'] },
            },
        });

        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

        return {
            enabled: (map['referral_enabled'] ?? 'true') === 'true',
            referrerReward: parseFloat(map['referrer_reward'] ?? String(DEFAULTS.referrerReward)),
            referredReward: parseFloat(map['referred_reward'] ?? String(DEFAULTS.referredReward)),
        };
    }

    async setConfig(key: string, value: string) {
        return this.prisma.appConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }

    async seedDefaults() {
        const defaults = [
            { key: 'referral_enabled', value: 'true' },
            { key: 'referrer_reward', value: '100' },
            { key: 'referred_reward', value: '50' },
        ];

        for (const d of defaults) {
            await this.prisma.appConfig.upsert({
                where: { key: d.key },
                update: {},
                create: d,
            });
        }

        return { message: 'Default config seeded.' };
    }
}
