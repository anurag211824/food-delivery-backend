import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantRequestDto } from './dto/create-restaurant-request.dto';
import { CreateDeliveryRequestDto } from './dto/create-delivery-request.dto';

@Injectable()
export class PartnerRequestsService {
    constructor(private readonly prisma: PrismaService) { }

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

        return this.prisma.restaurantRequest.create({
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
            },
        });
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

        return this.prisma.deliveryPartnerRequest.create({
            data: {
                userId,
                vehicleType: dto.vehicleType,
                licenseNumber: dto.licenseNumber,
                vehiclePlate: dto.vehiclePlate,
            },
        });
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
