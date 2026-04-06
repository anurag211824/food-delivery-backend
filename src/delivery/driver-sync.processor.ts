import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';

@Processor('driver-sync')
export class DriverSyncProcessor extends WorkerHost {
    private readonly logger = new Logger(DriverSyncProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        if (job.name !== 'sync-locations') return;

        this.logger.debug('Starting batch location sync: Redis → DB');

        try {
            // 1. Get ALL driver userIds currently in the Redis geo index
            const driverIds = await this.redis.zrange('driver_locations', 0, -1);

            if (driverIds.length === 0) {
                this.logger.debug('No active drivers in geo index. Skipping sync.');
                return;
            }

            // 2. Fetch all their positions in a single Redis call
            const positions = await this.redis.geopos('driver_locations', ...driverIds);

            // 3. Build update operations (only for drivers with valid positions)
            const updates: { userId: string; lat: number; lng: number }[] = [];

            for (let i = 0; i < driverIds.length; i++) {
                const pos = positions[i];
                if (pos && pos[0] && pos[1]) {
                    updates.push({
                        userId: driverIds[i],
                        lat: parseFloat(pos[1]),   // geopos returns [lng, lat]
                        lng: parseFloat(pos[0]),
                    });
                }
            }

            if (updates.length === 0) {
                this.logger.debug('No valid positions to sync.');
                return;
            }

            // 4. Batch update all driver locations in a single DB transaction
            await this.prisma.$transaction(
                updates.map(({ userId, lat, lng }) =>
                    this.prisma.driverProfile.updateMany({
                        where: { userId },
                        data: { currentLat: lat, currentLng: lng },
                    }),
                ),
            );

            this.logger.log(`Batch synced ${updates.length} driver location(s) to DB.`);
        } catch (err) {
            this.logger.error('Batch location sync failed:', err);
        }
    }
}
