import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── SEND A NOTIFICATION (INTERNAL USE) ───────────────────────────────
    async send(userId: string, title: string, body: string, type: string, data?: any) {
        const notification = await this.prisma.notification.create({
            data: { userId, title, body, type, data },
        });

        // TODO: When Firebase is configured, send FCM push here:
        // await this.sendFCMPush(userId, title, body, data);

        return notification;
    }

    // ─── BULK NOTIFICATION (ADMIN USE) ────────────────────────────────────
    async sendToAll(title: string, body: string, type = 'SYSTEM') {
        const users = await this.prisma.user.findMany({
            select: { id: true },
        });

        const notifications = users.map((u) => ({
            userId: u.id,
            title,
            body,
            type,
        }));

        await this.prisma.notification.createMany({ data: notifications });

        // TODO: Send FCM to all device tokens here

        return { sent: users.length };
    }

    // ─── GET MY NOTIFICATIONS ─────────────────────────────────────────────
    async getMyNotifications(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [data, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        return { data, total, unreadCount, page, limit };
    }

    // ─── MARK AS READ ─────────────────────────────────────────────────────
    async markAsRead(userId: string, notificationId: string) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    // ─── MARK ALL AS READ ─────────────────────────────────────────────────
    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
}
