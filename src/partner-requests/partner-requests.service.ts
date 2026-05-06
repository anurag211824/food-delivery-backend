import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantRequestDto } from './dto/create-restaurant-request.dto';
import { CreateDeliveryRequestDto } from './dto/create-delivery-request.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PartnerRequestsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService
    ) { }

    // ─── SUBMIT RESTAURANT APPLICATION ───────────────────────────────────────
    async submitRestaurantRequest(userId: string, dto: CreateRestaurantRequestDto) {
        // Check if user already has a pending/approved request
        const existing = await this.prisma.restaurantRequest.findUnique({
            where: { userId },
        });

        if (existing) {
            throw new ConflictException(
                `You already have a restaurant application with status: ${existing.status}. You cannot submit another.`,
            );
        }

        const request = await this.prisma.restaurantRequest.create({
            data: {
                userId,
                restaurantName: dto.restaurantName,
                description: dto.description,
                address: dto.address,
                lat: dto.lat,
                lng: dto.lng,
                cuisineTypes: dto.cuisineTypes,
                costForTwo: dto.costForTwo,
                fssaiCode: dto.fssaiCode,
                gstNumber: dto.gstNumber,
                logoUrl: dto.logoUrl,
                bannerUrl: dto.bannerUrl,
                fssaiDocUrl: dto.fssaiDocUrl,
            },
        });

        // Notify the user about the submission
        await this.notifications.send(
            userId,
            'Restaurant Application Submitted',
            `Your application for ${dto.restaurantName} is under review.`,
            'PARTNER_REQUEST'
        );

        return request;
    }

    // ─── SUBMIT DELIVERY PARTNER APPLICATION ──────────────────────────────────
    async submitDeliveryRequest(userId: string, dto: CreateDeliveryRequestDto) {
        const existing = await this.prisma.deliveryPartnerRequest.findUnique({
            where: { userId },
        });

        if (existing) {
            throw new ConflictException(
                `You already have a delivery partner application with status: ${existing.status}. You cannot submit another.`,
            );
        }

        const request = await this.prisma.deliveryPartnerRequest.create({
            data: {
                userId,
                vehicleType: dto.vehicleType,
                licenseNumber: dto.licenseNumber,
                vehiclePlate: dto.vehiclePlate,
                licenseFrontUrl: dto.licenseFrontUrl,
                licenseBackUrl: dto.licenseBackUrl,
                vehicleRcUrl: dto.vehicleRcUrl,
                profilePicUrl: dto.profilePicUrl,
                phoneNumber: dto.phoneNumber,
                email: dto.email,
            },
        });

        // Notify the user about the submission
        await this.notifications.send(
            userId,
            'Delivery Partner Application Submitted',
            `Your application to become a delivery partner is under review.`,
            'PARTNER_REQUEST'
        );

        return request;
    }

    // ─── GET MY RESTAURANT REQUEST ────────────────────────────────────────────
    async getMyRestaurantRequest(userId: string) {
        const request = await this.prisma.restaurantRequest.findUnique({
            where: { userId },
        });
        if (!request) {
            throw new NotFoundException('No restaurant application found for your account.');
        }
        return request;
    }

    // ─── GET MY DELIVERY REQUEST ──────────────────────────────────────────────
    async getMyDeliveryRequest(userId: string) {
        const request = await this.prisma.deliveryPartnerRequest.findUnique({
            where: { userId },
        });
        if (!request) {
            throw new NotFoundException('No delivery partner application found for your account.');
        }
        return request;
    }
}
