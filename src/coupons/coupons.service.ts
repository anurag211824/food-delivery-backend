import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── ADMIN: CREATE COUPON ─────────────────────────────────────────────
    async create(dto: CreateCouponDto) {
        return this.prisma.coupon.create({
            data: {
                code: dto.code.toUpperCase(),
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                maxDiscount: dto.maxDiscount,
                minOrder: dto.minOrder ?? 0,
                usageLimit: dto.usageLimit,
                perUserLimit: dto.perUserLimit ?? 1,
                validTo: new Date(dto.validTo),
                validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
            },
        });
    }

    // ─── ADMIN: LIST ALL COUPONS ──────────────────────────────────────────
    async findAll() {
        return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    }

    // ─── ADMIN: TOGGLE ACTIVE ─────────────────────────────────────────────
    async toggleActive(id: string, isActive: boolean) {
        const coupon = await this.prisma.coupon.findUnique({ where: { id } });
        if (!coupon) throw new NotFoundException('Coupon not found.');
        return this.prisma.coupon.update({ where: { id }, data: { isActive } });
    }

    // ─── CUSTOMER: VALIDATE & CALCULATE DISCOUNT ──────────────────────────
    async validate(code: string, userId: string, orderTotal: number) {
        const coupon = await this.prisma.coupon.findUnique({
            where: { code: code.toUpperCase() },
        });

        if (!coupon) throw new NotFoundException('Coupon not found.');
        if (!coupon.isActive) throw new BadRequestException('This coupon is no longer active.');

        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validTo) {
            throw new BadRequestException('This coupon has expired or is not yet valid.');
        }

        if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
            throw new BadRequestException('This coupon has reached its usage limit.');
        }

        if (orderTotal < coupon.minOrder) {
            throw new BadRequestException(`Minimum order amount is ₹${coupon.minOrder}.`);
        }

        // Check per-user limit
        const userUsageCount = await this.prisma.couponUsage.count({
            where: { couponId: coupon.id, userId },
        });

        if (userUsageCount >= coupon.perUserLimit) {
            throw new BadRequestException('You have already used this coupon the maximum number of times.');
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'PERCENTAGE') {
            discount = (orderTotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else {
            discount = coupon.discountValue;
        }

        // Never discount more than order total
        discount = Math.min(discount, orderTotal);

        return {
            valid: true,
            code: coupon.code,
            discountType: coupon.discountType,
            discount: Math.round(discount * 100) / 100,
            message: `You save ₹${discount.toFixed(0)}!`,
        };
    }

    // ─── INTERNAL: Record usage after order is placed ─────────────────────
    async recordUsage(code: string, userId: string, orderId: string) {
        const coupon = await this.prisma.coupon.findUnique({
            where: { code: code.toUpperCase() },
        });
        if (!coupon) return;

        await this.prisma.$transaction([
            this.prisma.couponUsage.create({
                data: { couponId: coupon.id, userId, orderId },
            }),
            this.prisma.coupon.update({
                where: { id: coupon.id },
                data: { timesUsed: { increment: 1 } },
            }),
        ]);
    }

    // ─── CUSTOMER: LIST AVAILABLE COUPONS ─────────────────────────────────
    async getAvailableForUser(userId: string) {
        const now = new Date();
        const coupons = await this.prisma.coupon.findMany({
            where: {
                isActive: true,
                validFrom: { lte: now },
                validTo: { gte: now },
            },
            orderBy: { discountValue: 'desc' },
        });

        // Filter out fully used coupons and per-user exceeded coupons
        const available: typeof coupons = [];
        for (const c of coupons) {
            if (c.usageLimit && c.timesUsed >= c.usageLimit) continue;
            const userUses = await this.prisma.couponUsage.count({
                where: { couponId: c.id, userId },
            });
            if (userUses >= c.perUserLimit) continue;
            available.push(c);
        }

        return available;
    }
}
