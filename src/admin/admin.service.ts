import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    // ─── LIST USERS ───────────────────────────────────────────────────────────
    async listUsers(role?: Role, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = role ? { role } : {};

        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    role: true,
                    referralCode: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    // ─── UPDATE USER ROLE ─────────────────────────────────────────────────────
    async updateUserRole(dto: UpdateUserRoleDto, requestingAdminId: string) {
        if (dto.userId === requestingAdminId) {
            throw new ForbiddenException('You cannot change your own role.');
        }

        const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
        if (!user) {
            throw new NotFoundException(`User with id "${dto.userId}" not found.`);
        }

        const updated = await this.prisma.user.update({
            where: { id: dto.userId },
            data: { role: dto.role },
            select: { id: true, name: true, email: true, phoneNumber: true, role: true },
        });

        return { message: `Role successfully updated to ${dto.role}.`, user: updated };
    }

    // ─── BAN / UNBAN RESTAURANT ───────────────────────────────────────────────
    async toggleRestaurantActive(restaurantId: string, isActive: boolean) {
        const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
        if (!restaurant) throw new NotFoundException(`Restaurant "${restaurantId}" not found.`);

        const updated = await this.prisma.restaurant.update({
            where: { id: restaurantId },
            data: { isActive },
            select: { id: true, name: true, isActive: true, isVerified: true },
        });

        return { message: `Restaurant "${updated.name}" has been ${isActive ? 'activated' : 'deactivated'}.`, restaurant: updated };
    }

    // ─── VERIFY RESTAURANT ────────────────────────────────────────────────────
    async verifyRestaurant(restaurantId: string, isVerified: boolean) {
        const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
        if (!restaurant) throw new NotFoundException(`Restaurant "${restaurantId}" not found.`);

        const updated = await this.prisma.restaurant.update({
            where: { id: restaurantId },
            data: { isVerified },
            select: { id: true, name: true, isActive: true, isVerified: true },
        });

        return { message: `Restaurant "${updated.name}" has been ${isVerified ? 'verified' : 'unverified'}.`, restaurant: updated };
    }

    // ─── LIST PARTNER REQUESTS ────────────────────────────────────────────────
    async listRequests(type: 'restaurant' | 'delivery', status?: RequestStatus, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = status ? { status } : {};

        if (type === 'restaurant') {
            const [data, total] = await Promise.all([
                this.prisma.restaurantRequest.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        user: { select: { id: true, name: true, email: true, phoneNumber: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                this.prisma.restaurantRequest.count({ where })
            ]);
            return { data, total, page, limit };
        }

        const [data, total] = await Promise.all([
            this.prisma.deliveryPartnerRequest.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, name: true, email: true, phoneNumber: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.deliveryPartnerRequest.count({ where })
        ]);

        return { data, total, page, limit };
    }

    // ─── APPROVE RESTAURANT REQUEST ───────────────────────────────────────────
    async approveRestaurantRequest(requestId: string) {
        const request = await this.prisma.restaurantRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) throw new NotFoundException(`Restaurant request "${requestId}" not found.`);
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`This request is already ${request.status}.`);
        }

        const existingRestaurant = await this.prisma.restaurant.findUnique({
            where: { managerId: request.userId }
        });

        if (existingRestaurant) {
            // Auto-reject the request because they already have one, or just throw.
            throw new BadRequestException(`This user already manages a restaurant ("${existingRestaurant.name}").`);
        }


        // ⚡ Atomic transaction: update request + update user role + create Restaurant
        const [updatedRequest, restaurant] = await this.prisma.$transaction([
            // 1. Mark request as approved
            this.prisma.restaurantRequest.update({
                where: { id: requestId },
                data: { status: RequestStatus.APPROVED },
            }),
            // 2. Update user role to RESTAURANT_MANAGER
            this.prisma.user.update({
                where: { id: request.userId },
                data: { role: Role.RESTAURANT_MANAGER },
            }),
            // 3. Create the actual Restaurant record from the request form data
            this.prisma.restaurant.create({
                data: {
                    managerId: request.userId,
                    name: request.restaurantName,
                    description: request.description,
                    address: request.address,
                    lat: request.lat,
                    lng: request.lng,
                    cuisineTypes: request.cuisineTypes,
                    costForTwo: request.costForTwo,
                    logo: request.logoUrl,
                    banner: request.bannerUrl,
                    fssaiCode: request.fssaiCode,
                    gstNumber: request.gstNumber,
                    isVerified: true, // Auto-verified since admin manually approved
                    isActive: true,
                },
            }),
        ]);

        await this.notifications.send(
            request.userId,
            'Restaurant Application Approved',
            `Congratulations! Your application for ${request.restaurantName} has been approved.`,
            'PARTNER_REQUEST_APPROVED'
        );

        return {
            message: 'Restaurant request approved. Restaurant profile created and user promoted to RESTAURANT_MANAGER.',
            request: updatedRequest,
            restaurant,
        };
    }

    // ─── REJECT RESTAURANT REQUEST ────────────────────────────────────────────
    async rejectRestaurantRequest(requestId: string, reason?: string) {
        const request = await this.prisma.restaurantRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException(`Restaurant request "${requestId}" not found.`);
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`This request is already ${request.status}.`);
        }

        const updated = await this.prisma.restaurantRequest.update({
            where: { id: requestId },
            data: { status: RequestStatus.REJECTED, rejectionReason: reason },
        });

        await this.notifications.send(
            request.userId,
            'Restaurant Application Rejected',
            `Unfortunately, your application for ${request.restaurantName} was rejected. ${reason ? 'Reason: ' + reason : ''}`,
            'PARTNER_REQUEST_REJECTED'
        );

        return { message: 'Restaurant request rejected.', request: updated };
    }

    // ─── APPROVE DELIVERY PARTNER REQUEST ────────────────────────────────────
    async approveDeliveryRequest(requestId: string) {
        const request = await this.prisma.deliveryPartnerRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) throw new NotFoundException(`Delivery request "${requestId}" not found.`);
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`This request is already ${request.status}.`);
        }

        // ⚡ Atomic transaction: update request + update user role + create DriverProfile
        const [updatedRequest, driverProfile] = await this.prisma.$transaction([
            // 1. Mark request as approved
            this.prisma.deliveryPartnerRequest.update({
                where: { id: requestId },
                data: { status: RequestStatus.APPROVED },
            }),
            // 2. Update user role to DELIVERY_PARTNER
            this.prisma.user.update({
                where: { id: request.userId },
                data: { role: Role.DELIVERY_PARTNER },
            }),
            // 3. Create the actual DriverProfile from the request form data
            this.prisma.driverProfile.create({
                data: {
                    userId: request.userId,
                    vehicleType: request.vehicleType,
                    licenseNumber: request.licenseNumber,
                    vehiclePlate: request.vehiclePlate,
                    profilePic: request.profilePicUrl,
                    status: 'OFFLINE',
                },
            }),
        ]);

        await this.notifications.send(
            request.userId,
            'Delivery Partner Application Approved',
            `Congratulations! Your application to become a delivery partner has been approved.`,
            'PARTNER_REQUEST_APPROVED'
        );

        return {
            message: 'Delivery request approved. Driver profile created and user promoted to DELIVERY_PARTNER.',
            request: updatedRequest,
            driverProfile,
        };
    }

    // ─── REJECT DELIVERY PARTNER REQUEST ─────────────────────────────────────
    async rejectDeliveryRequest(requestId: string, reason?: string) {
        const request = await this.prisma.deliveryPartnerRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException(`Delivery request "${requestId}" not found.`);
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`This request is already ${request.status}.`);
        }

        const updated = await this.prisma.deliveryPartnerRequest.update({
            where: { id: requestId },
            data: { status: RequestStatus.REJECTED, rejectionReason: reason },
        });

        await this.notifications.send(
            request.userId,
            'Delivery Partner Application Rejected',
            `Unfortunately, your application to become a delivery partner was rejected. ${reason ? 'Reason: ' + reason : ''}`,
            'PARTNER_REQUEST_REJECTED'
        );

        return { message: 'Delivery partner request rejected.', request: updated };
    }

    // ─── PLATFORM STATS (ADMIN DASHBOARD) ─────────────────────────────────
    async getPlatformStats() {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            totalUsers,
            totalRestaurants,
            totalOrders,
            todayOrders,
            totalRevenue,
            activeDrivers,
            pendingRestaurantRequests,
            pendingDeliveryRequests,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.restaurant.count(),
            this.prisma.order.count(),
            this.prisma.order.count({ where: { placedAt: { gte: todayStart } } }),
            this.prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: { status: 'DELIVERED' },
            }),
            this.prisma.driverProfile.count({ where: { status: 'ONLINE' } }),
            this.prisma.restaurantRequest.count({ where: { status: 'PENDING' } }),
            this.prisma.deliveryPartnerRequest.count({ where: { status: 'PENDING' } }),
        ]);

        return {
            totalUsers,
            totalRestaurants,
            totalOrders,
            todayOrders,
            totalRevenue: totalRevenue._sum.totalAmount || 0,
            activeDrivers,
            pendingRequests: {
                restaurant: pendingRestaurantRequests,
                delivery: pendingDeliveryRequests,
            },
        };
    }

    // ─── LIST ALL ORDERS (ADMIN) ──────────────────────────────────────────
    async getAllOrders(status?: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = status ? { status: status as any } : {};

        const [data, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    restaurant: { select: { id: true, name: true } },
                    driver: { select: { id: true, userId: true } },
                },
                orderBy: { placedAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        return { data, total, page, limit };
    }
}
