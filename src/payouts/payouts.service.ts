import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── NIGHTLY CRON JOB FOR SETTLEMENTS ──────────────────────────────────
  // Runs every day at midnight (00:00) to calculate settlements for the previous day
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNightlySettlements() {
    this.logger.log(
      '🚀 Starting nightly merchant payouts calculation job...',
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    this.logger.log(
      `Calculating settlements for period: ${startOfYesterday.toISOString()} to ${endOfYesterday.toISOString()}`,
    );

    let createdCount = 0;

    // ─── 1. RESTAURANT SETTLEMENTS ───────────────────────────────────────────
    const restaurants = await this.prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, managerId: true },
    });

    for (const restaurant of restaurants) {
      try {
        const orders = await this.prisma.order.findMany({
          where: {
            restaurantId: restaurant.id,
            status: 'DELIVERED',
            deliveredAt: {
              gte: startOfYesterday,
              lte: endOfYesterday,
            },
          },
          select: {
            id: true,
            itemTotal: true,
            tax: true,
            commission: true,
            totalAmount: true,
          },
        });

        if (orders.length === 0) continue;

        const existingSettlement = await this.prisma.settlement.findFirst({
          where: {
            restaurantId: restaurant.id,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });

        if (existingSettlement) {
          this.logger.warn(
            `Settlement already exists for restaurant ${restaurant.name} today. Skipping.`,
          );
          continue;
        }

        let totalRevenue = 0;
        let totalCommission = 0;

        for (const order of orders) {
          totalRevenue += order.itemTotal + order.tax;
          totalCommission += order.commission;
        }

        const netPayout = totalRevenue - totalCommission;

        if (netPayout <= 0) {
          this.logger.warn(
            `Net payout for ${restaurant.name} is ${netPayout}. Skipping settlement creation.`,
          );
          continue;
        }

        const dateLabel = startOfYesterday.toISOString().slice(0, 10);
        await this.prisma.settlement.create({
          data: {
            restaurantId: restaurant.id,
            totalRevenue,
            commission: totalCommission,
            amount: netPayout,
            status: 'PENDING',
            description: `Daily settlement for ${orders.length} order${orders.length > 1 ? 's' : ''} on ${dateLabel} — ${restaurant.name}`,
          },
        });

        createdCount++;
        this.logger.log(
          `Created PENDING settlement for restaurant ${restaurant.name}: Net Payout = ₹${netPayout.toFixed(
            2,
          )} (Revenue = ₹${totalRevenue.toFixed(2)}, Commission = ₹${totalCommission.toFixed(2)})`,
        );
      } catch (error: any) {
        this.logger.error(
          `Error calculating settlement for restaurant ${restaurant.name}:`,
          error.stack,
        );
      }
    }

    // ─── 2. DARK STORE SETTLEMENTS ──────────────────────────────────────────
    const stores = await this.prisma.store.findMany({
      where: { isActive: true },
      select: { id: true, name: true, managerId: true },
    });

    for (const store of stores) {
      try {
        const orders = await this.prisma.order.findMany({
          where: {
            storeId: store.id,
            status: 'DELIVERED',
            deliveredAt: {
              gte: startOfYesterday,
              lte: endOfYesterday,
            },
          },
          select: {
            id: true,
            itemTotal: true,
            tax: true,
            commission: true,
            totalAmount: true,
          },
        });

        if (orders.length === 0) continue;

        const existingSettlement = await this.prisma.settlement.findFirst({
          where: {
            storeId: store.id,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });

        if (existingSettlement) {
          this.logger.warn(
            `Settlement already exists for store ${store.name} today. Skipping.`,
          );
          continue;
        }

        let totalRevenue = 0;
        let totalCommission = 0;

        for (const order of orders) {
          totalRevenue += order.itemTotal + order.tax;
          totalCommission += order.commission;
        }

        const netPayout = totalRevenue - totalCommission;

        if (netPayout <= 0) {
          this.logger.warn(
            `Net payout for store ${store.name} is ${netPayout}. Skipping settlement creation.`,
          );
          continue;
        }

        const dateLabel = startOfYesterday.toISOString().slice(0, 10);
        await this.prisma.settlement.create({
          data: {
            storeId: store.id,
            totalRevenue,
            commission: totalCommission,
            amount: netPayout,
            status: 'PENDING',
            description: `Daily settlement for ${orders.length} grocery order${orders.length > 1 ? 's' : ''} on ${dateLabel} — ${store.name}`,
          },
        });

        createdCount++;
        this.logger.log(
          `Created PENDING settlement for store ${store.name}: Net Payout = ₹${netPayout.toFixed(
            2,
          )} (Revenue = ₹${totalRevenue.toFixed(2)}, Commission = ₹${totalCommission.toFixed(2)})`,
        );
      } catch (error: any) {
        this.logger.error(
          `Error calculating settlement for store ${store.name}:`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `✅ Nightly payouts calculation job complete. Created ${createdCount} settlements.`,
    );
  }

  // ─── ADMIN: GET ALL SETTLEMENTS ───────────────────────────────────────
  async getSettlements(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        skip,
        take: limit,
        include: {
          restaurant: {
            select: {
              name: true,
              address: true,
              manager: {
                select: {
                  name: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
          store: {
            select: {
              name: true,
              address: true,
              manager: {
                select: {
                  name: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ─── ADMIN: PROCESS / RESOLVE SETTLEMENT ──────────────────────────────
  async resolveSettlement(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            name: true,
            managerId: true,
          },
        },
        store: {
          select: {
            name: true,
            managerId: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID "${id}" not found.`);
    }

    if (settlement.status === 'PAID') {
      throw new BadRequestException(
        'This settlement is already marked as PAID.',
      );
    }

    // Process: Mark as PAID in db and set settledAt timestamp
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: 'PAID',
        settledAt: new Date(),
      },
    });

    const merchantName =
      settlement.restaurant?.name || settlement.store?.name || 'Merchant';
    this.logger.log(
      `Settlement ${id} for ${merchantName} marked as PAID.`,
    );
    return {
      message: 'Settlement marked as PAID successfully.',
      settlement: updated,
    };
  }

  // ─── MANUAL TRIGGER FOR TESTING / RUNNING AD-HOC ──────────────────────
  async triggerManualSettlementRun() {
    await this.handleNightlySettlements();
    return { message: 'Settlement job triggered and run successfully.' };
  }
}
