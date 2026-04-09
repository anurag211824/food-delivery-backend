import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
    private expo: Expo;
    private readonly logger = new Logger(NotificationsService.name);

    constructor(private readonly prisma: PrismaService) {
        // Initialize Expo client
        this.expo = new Expo();
    }

    // ─── SEND A NOTIFICATION (INTERNAL USE) ───────────────────────────────
    async send(userId: string, title: string, body: string, type: string, data?: any) {
        const notification = await this.prisma.notification.create({
            data: { userId, title, body, type, data },
        });

        // 1. Fetch user's active push tokens
        const activeSessions = await this.prisma.session.findMany({
            where: {
                userId,
                pushToken: { not: null }
            },
            select: { pushToken: true }
        });

        const tokens = activeSessions.map(s => s.pushToken as string);

        if (tokens.length > 0) {
            await this.sendExpoPush(tokens, title, body, data);
        }

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

        // Fetch all unique push tokens in the system
        const sessions = await this.prisma.session.findMany({
            where: { pushToken: { not: null } },
            select: { pushToken: true }
        });

        const tokens = Array.from(new Set(sessions.map(s => s.pushToken as string)));

        if (tokens.length > 0) {
            await this.sendExpoPush(tokens, title, body);
        }

        return { sent: users.length };
    }

    // ─── EXPO PUSH HELPERS ────────────────────────────────────────────────
    private async sendExpoPush(pushTokens: string[], title: string, body: string, data?: any) {
        const messages: ExpoPushMessage[] = [];

        // Pre-filter valid Expo tokens
        for (const pushToken of pushTokens) {
            if (!Expo.isExpoPushToken(pushToken)) {
                this.logger.warn(`Push token ${pushToken} is not a valid Expo push token`);
                continue;
            }

            messages.push({
                to: pushToken,
                sound: 'default',
                title,
                body,
                data: data || {},
            });
        }

        // The Expo SDK auto-batches requests
        const chunks = this.expo.chunkPushNotifications(messages);
        
        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                // Can log or process ticketChunk to find unregistered devices to prune them
            } catch (error: any) {
                if (error.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS' && error.details) {
                    this.logger.warn('Mixed experience IDs detected, grouping and retrying...');
                    
                    const details = error.details as Record<string, string[]>;
                    for (const [experienceId, tokens] of Object.entries(details)) {
                        const projectMessages = chunk.filter(m => {
                            if (typeof m.to === 'string') {
                                return tokens.includes(m.to);
                            } else if (Array.isArray(m.to)) {
                                return m.to.some(t => tokens.includes(t));
                            }
                            return false;
                        });

                        if (projectMessages.length > 0) {
                            const projectChunks = this.expo.chunkPushNotifications(projectMessages);
                            for (const projChunk of projectChunks) {
                                try {
                                    await this.expo.sendPushNotificationsAsync(projChunk);
                                } catch (retryError) {
                                    this.logger.error(`Error sending push to project ${experienceId}`, retryError);
                                }
                            }
                        }
                    }
                } else {
                    this.logger.error('Error sending Expo push notification chunk', error);
                }
            }
        }
    }

    // ─── REGISTER PUSH TOKEN ──────────────────────────────────────────────
    async registerPushToken(sessionId: string, pushToken: string) {
        return this.prisma.session.update({
            where: { id: sessionId },
            data: { pushToken },
            select: { id: true, userId: true, pushToken: true }
        });
    }

    // ─── GET PUSH TOKEN ──────────────────────────────────────────────────
    async getPushToken(sessionId: string) {
        return this.prisma.session.findUnique({
            where: { id: sessionId },
            select: { id: true, userId: true, pushToken: true }
        });
    }

    // ─── UPDATE PUSH TOKEN ───────────────────────────────────────────────
    async updatePushToken(sessionId: string, pushToken: string | null) {
        return this.prisma.session.update({
            where: { id: sessionId },
            data: { pushToken },
            select: { id: true, userId: true, pushToken: true }
        });
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
