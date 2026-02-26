/**
 * Seed script: Creates the default AppConfig rows for the referral policy.
 * Run with: npx ts-node prisma/seed-config.ts
 * Safe to run multiple times — uses upsert so no duplicates.
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Manually load the .env file
dotenv.config();

// 2. Create a PostgreSQL pool and adapter for Prisma 7
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const defaults = [
        { key: 'referral_enabled', value: 'true' },
        { key: 'referrer_reward', value: '100' },   // Rs 100 to the person who invited
        { key: 'referred_reward', value: '50' },    // Rs 50 welcome bonus to the new user
    ];

    for (const config of defaults) {
        await prisma.appConfig.upsert({
            where: { key: config.key },
            update: {},              // Don't overwrite existing admin changes
            create: config,
        });
    }

    console.log('✅ Default AppConfig seeded successfully');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
