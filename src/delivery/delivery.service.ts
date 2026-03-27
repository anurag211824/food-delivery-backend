import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DriverStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly walletsService: WalletsService,
  ) { }

  async createProfile(userId: string, dto: CreateDeliveryDto) {
    const existing = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException("You already have a driver profile!")
    }

    return this.prisma.driverProfile.create({
      data: {
        userId,
        vehicleType: dto.vehicleType,
        licenseNumber: dto.licenseNumber,
        vehiclePlate: dto.vehicleLicensePlate,
      }
    })
  }
  async getProfile(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { name: true, email: true, phoneNumber: true, image: true }
        }
      }
    });

    if (!profile) {
      throw new NotFoundException('Driver profile not found.');
    }

    return profile;
  }

  // change status ( online / offline)

  async toggleStatus(userId: string, status: DriverStatus) {

    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Driver profile not found. Please setup profile first.")
    }
    return this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { status: status }
    })
  }

  // Phase 2: Order Assignment and Completion

  async getAvailableOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found.');
    if (profile.status !== 'ONLINE') throw new ConflictException('You must be ONLINE to see orders.');

    return this.prisma.order.findMany({
      where: {
        status: 'READY',
        driverId: null, // Only orders without a driver
      },
      include: {
        restaurant: {
          select: { name: true, address: true, lat: true, lng: true }
        },
        customer: {
          select: { name: true, phoneNumber: true }
        }
      },
      orderBy: { placedAt: 'asc' }
    });
  }

  async acceptOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'READY' || order.driverId !== null) {
      throw new ConflictException('Order is no longer available.');
    }

    // Atomic assignment
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: profile.id,
        status: 'ON_THE_WAY',
        pickedUpAt: new Date(),
      }
    });

    this.eventsGateway.emitOrderStatusChange(orderId, 'ON_THE_WAY');

    return updatedOrder;
  }

  async completeOrder(userId: string, orderId: string, otp: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }

    if (order.status !== 'ON_THE_WAY') {
      throw new ConflictException('Order must be ON_THE_WAY to complete it.');
    }

    if (order.otp !== otp) {
      throw new BadRequestException('Invalid OTP. Please check with the customer.');
    }

    // ⚡ Atomic: mark delivered + increment delivery count
    const deliveredOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      }
    });

    // Increment totalDeliveries counter on driver profile
    await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { totalDeliveries: { increment: 1 } },
    });

    // 💰 Credit driver earnings: deliveryCharge + driverTip → driver's wallet
    const driverEarnings = order.deliveryCharge + order.driverTip;
    if (driverEarnings > 0) {
      await this.walletsService.addFunds(
        userId,
        driverEarnings,
        `DELIVERY_EARNING:${order.id}`,
      );
    }

    this.eventsGateway.emitOrderStatusChange(orderId, 'DELIVERED');

    return deliveredOrder;
  }

  // ─── GET MY CURRENT ORDER ──────────────────────────────────────────────
  async getMyCurrentOrder(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        driverId: profile.id,
        status: 'ON_THE_WAY',
      },
      include: {
        restaurant: {
          select: { name: true, address: true, lat: true, lng: true, image: true },
        },
        customer: {
          select: { name: true, phoneNumber: true },
        },
        items: {
          include: { menuItem: true },
        },
      },
    });

    if (!activeOrder) {
      return { message: 'No active delivery at the moment.', order: null };
    }

    return activeOrder;
  }

  // ─── GET MY EARNINGS SUMMARY ───────────────────────────────────────────
  async getMyEarnings(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    return {
      totalDeliveries: profile.totalDeliveries,
      rating: profile.rating,
      ratingCount: profile.ratingCount,
    };
  }

  // ─── GET ORDER ROUTE ───────────────────────────────────────────────────
  async getOrderRoute(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: { name: true, address: true, lat: true, lng: true },
        },
        customer: {
          select: { name: true, phoneNumber: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found.');
    // Allow if driver is assigned OR if the order is still READY (so driver can view preview route before accepting)
    if (order.driverId && order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }

    // Determine dropoff location from customer's default address or fallback to first saved address
    const customerAddress = await this.prisma.address.findFirst({
      where: { userId: order.customerId },
      orderBy: { isDefault: 'desc' }, // Prioritizes true over false
    });

    if (!customerAddress) {
      throw new NotFoundException('Customer delivery address not found.');
    }

    return {
      orderId: order.id,
      status: order.status,
      pickup: {
        name: order.restaurant.name,
        address: order.restaurant.address,
        lat: order.restaurant.lat,
        lng: order.restaurant.lng,
      },
      dropoff: {
        name: order.customer.name,
        phone: order.customer.phoneNumber,
        address: customerAddress.addressLine,
        landmark: customerAddress.landmark,
        lat: customerAddress.lat,
        lng: customerAddress.lng,
      },
      // Calculate a rough straight-line distance in km using Haversine
      distanceKm: this.calculateDistance(
        order.restaurant.lat,
        order.restaurant.lng,
        customerAddress.lat,
        customerAddress.lng
      ).toFixed(2),
    };
  }

  // Helper function to calculate distance in km 
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
