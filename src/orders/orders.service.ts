import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from '../common/pagination.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus, PaymentMethod, Role, User } from '@prisma/client';
import { WalletsService } from '../wallets/wallets.service';
import { EventsGateway } from '../events/events.gateway';
import { CouponsService } from '../coupons/coupons.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private eventsGateway: EventsGateway,
    private couponsService: CouponsService,
    private notificationsService: NotificationsService,
    @InjectQueue('orders') private orderQueue: Queue,
  ) { }

  async create(userId: string, dto: CreateOrderDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) throw new NotFoundException("Restaurant not found");
    if (!restaurant.isOpen) throw new BadRequestException("Restaurant is closed");

    // Fetch the customer's default address for distance calculation
    const userAddress = await this.prisma.address.findFirst({
      where: { userId, isDefault: true },
    });

    // Fetch real prices from database
    const dbItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: dto.items.map((i) => i.menuItemId) },
        category: {
          restaurantId: dto.restaurantId,
        },
      },
    });

    if (dbItems.length !== dto.items.length) {
      throw new BadRequestException("Some items are invalid");
    }

    // Perform calculations
    let itemTotal = 0;

    const orderItemsData = dto.items.map((item) => {
      const dbItem = dbItems.find((d) => d.id === item.menuItemId);
      const price = dbItem!.price;
      itemTotal += price * item.quantity;

      return {
        quantity: item.quantity,
        price: price,
        menuItemId: item.menuItemId,
      };
    });

    // ─── DYNAMIC DELIVERY FEE (Haversine distance) ────────────────────────
    let deliveryCharge = 30; // fallback flat rate
    if (userAddress && restaurant.lat && restaurant.lng) {
      const distanceKm = this.calculateDistance(
        userAddress.lat, userAddress.lng,
        restaurant.lat, restaurant.lng,
      );
      // Formula: Base ₹15 + ₹7 per km, capped at ₹60
      deliveryCharge = Math.min(60, Math.round(15 + distanceKm * 7));
    }

    // ─── COUPON DISCOUNT ──────────────────────────────────────────────────
    let discount = 0;
    if (dto.promoCode) {
      const result = await this.couponsService.validate(dto.promoCode, userId, itemTotal);
      discount = result.discount;
    }

    // ─── PLATFORM COMMISSION (20% of item total) ──────────────────────────
    const commission = Math.round(itemTotal * 0.20 * 100) / 100;

    const tax = Math.round(itemTotal * 0.05 * 100) / 100;
    const platformFee = 5;
    const driverTip = dto.driverTip ?? 0;
    const totalAmount = Math.round((itemTotal + tax + deliveryCharge + platformFee + driverTip - discount) * 100) / 100;

    // Generate a simple 4 digit OTP for delivery verification
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // ─── Step 1: Create the order atomically (no wallet call inside) ──────────
    const order = await this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId: userId,
          restaurantId: dto.restaurantId,
          status: 'PLACED',
          otp: otp,
          itemTotal,
          tax,
          deliveryCharge,
          platformFee,
          driverTip,
          discount,
          promoCode: dto.promoCode?.toUpperCase() || null,
          commission,
          totalAmount,
          paymentMode: dto.paymentMode,
          isPaid: false,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: { menuItem: true }
          }
        },
      });
    });

    // ─── Step 2: Charge wallet AFTER order is committed ───────────────────────
    if (dto.paymentMode === PaymentMethod.WALLET) {
      try {
        await this.walletsService.charge(userId, totalAmount, `ORDER_PAYMENT:${order.id}`);
        await this.prisma.order.update({
          where: { id: order.id },
          data: { isPaid: true },
        });
        order.isPaid = true;
      } catch (err) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancellationReason: 'Insufficient wallet balance' },
        });
        throw err;
      }
    }

    // ─── Step 3: Record coupon usage ──────────────────────────────────────
    if (dto.promoCode && discount > 0) {
      await this.couponsService.recordUsage(dto.promoCode, userId, order.id);
    }

    // ─── Step 4: Notify restaurant manager ───────────────────────────────
    this.notificationsService.send(
      restaurant.managerId,
      '🔔 New Order!',
      `A new order of ₹${totalAmount} has been placed.`,
      'ORDER_UPDATE',
      { orderId: order.id },
    );

    // ─── Step 5: Real-time — Push new order to restaurant dashboard ──────
    this.eventsGateway.emitNewOrderToRestaurant(restaurant.id, {
      orderId: order.id,
      totalAmount,
      itemCount: order.items.length,
      paymentMode: dto.paymentMode,
      timestamp: new Date().toISOString(),
    });

    // ─── Step 6: Auto-join customer into this order's tracking room ──────
    this.eventsGateway.joinUserToOrderRoom(userId, order.id);

    // ─── Step 7: Schedule Auto-Cancel for Unpaid Orders ──────────────────
    if (!order.isPaid && order.paymentMode !== 'COD') {
      await this.orderQueue.add(
        'cancel-unpaid-order',
        { orderId: order.id },
        { delay: 10 * 60 * 1000 }, // 10 minutes
      );
    }

    // ─── Step 7b: Safety net — cancel orders the restaurant ignores ──────
    // If the order is still in PLACED after 10 minutes (restaurant never
    // accepted/refused), auto-cancel it. This covers ALL payment modes.
    await this.orderQueue.add(
      'cancel-stale-placed-order',
      { orderId: order.id },
      { delay: 10 * 60 * 1000 }, // 10 minutes
    );

    return order;
  }

  // ─── HAVERSINE DISTANCE CALCULATION ─────────────────────────────────────
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async updateStatus(orderId: string, status: OrderStatus, actor: Pick<User, 'id' | 'role'>) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: true
      }
    });

    if (!order) throw new NotFoundException("Order not found");

    // Safety Guard: If already in this status, just return (prevents duplicate dispatch chains)
    if (order.status === status) {
      return order;
    }

    if (actor.role !== Role.ADMIN && order.restaurant.managerId !== actor.id) {
      throw new ForbiddenException("You do not have permission to manage this restaurant")
    }

    const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      PLACED: ['ACCEPTED', 'CANCELLED', 'REFUSED'],
      ACCEPTED: ['PREPARING', 'CANCELLED', 'REFUSED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['ON_THE_WAY', 'PICKED_UP', 'CANCELLED'],
      PICKED_UP: ['ON_THE_WAY', 'DELIVERED'],
      ON_THE_WAY: ['DELIVERED'],
    };

    const nextAllowedStatuses = allowedTransitions[order.status] ?? [];
    if (!nextAllowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Cannot change order status from "${order.status}" to "${status}".`,
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : undefined,
        pickedUpAt: status === 'PICKED_UP' ? new Date() : undefined,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      }
    });

    // 🚀 Real-time event!
    this.eventsGateway.emitOrderStatusChange(orderId, status);

    // 📱 Push Notification!
    let title = 'Order Update';
    let body = `Your order is now ${status}`;
    
    // Make messages more user-friendly based on status
    if (status === 'ACCEPTED') {
      title = 'Order Accepted! 🍔';
      body = 'The restaurant has accepted your order and is preparing it.';
    } else if (status === 'READY') {
      title = 'Order is Ready! 🛍️';
      body = 'The restaurant has finished preparing your order. Assigning a delivery partner...';
      
      // 🔥 TRIGGER AUTO-DISPATCH 🔥
      this.orderQueue.add(
        'dispatch-order', 
        { orderId: orderId, ignoredDriverIds: [], attemptCount: 0 },
        { jobId: `dispatch-${orderId}`, removeOnComplete: true }
      ).catch(e => console.error('Failed to trigger auto-dispatch', e));

    } else if (status === 'ON_THE_WAY') {
      title = 'Out for Delivery! 🛵';
      body = 'Your food is on the way to you.';
    } else if (status === 'DELIVERED') {
      title = 'Order Delivered! 🎉';
      body = 'Enjoy your meal!';
    } else if (status === 'CANCELLED') {
      title = 'Order Cancelled ❌';
      body = 'Your order has been cancelled.';
    }

    this.notificationsService.send(
      order.customerId,
      title,
      body,
      'ORDER_UPDATE',
      { orderId, status }).catch(e => console.error('Failed to send order update push notification', e));

    // 🧹 Auto-cleanup room on terminal statuses
    if (['DELIVERED', 'CANCELLED', 'REFUSED'].includes(status)) {
      this.eventsGateway.cleanupOrderRoom(orderId);
    }

    return updatedOrder;
  }

  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: true,
        items: {
          include: { menuItem: true }
        },
        restaurant: true
      }
    });
    if (!order) throw new NotFoundException("Order not found");

    return order;
  }

  async getCurrentOrder(userId: string) {
    const currentOrder = await this.prisma.order.findFirst({
      where: {
        customerId: userId,
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'REFUSED']
        }
      },
      include: {
        restaurant: {
          select: { name: true, image: true, id: true, address: true, lat: true, lng: true }
        },
        driver: {
          select: { user: { select: { name: true, phoneNumber: true } }, vehiclePlate: true, profilePic: true }
        },
        items: {
          include: { menuItem: true }
        }
      },
      orderBy: { placedAt: 'desc' }
    });

    if (!currentOrder) {
      throw new NotFoundException("No active order found");
    }
    
    return currentOrder;
  }

  async getCustomerOrders(userId: string, dto: PaginationDto) {
    const pageNumber = dto.page || 1;
    const limitNumber = dto.limit || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: userId },
        skip,
        take: limitNumber,
        include: {
          restaurant: {
            select: { name: true, image: true, id: true }
          },
          items: {
            include: { menuItem: true }
          }
        },
        orderBy: { placedAt: 'desc' }
      }),
      this.prisma.order.count({ where: { customerId: userId } })
    ]);

    return { data, meta: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) } };
  }

  async getRestaurantOrders(managerId: string, dto: PaginationDto) {
    const pageNumber = dto.page || 1;
    const limitNumber = dto.limit || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      restaurant: {
        managerId: managerId,
      }
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limitNumber,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: { menuItem: true },
          },
        },
        orderBy: { placedAt: 'desc' },
      }),
      this.prisma.order.count({ where })
    ]);

    return { data, meta: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) } };
  }

  // ─── CUSTOMER CANCEL ORDER ──────────────────────────────────────────────
  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== userId) {
      throw new ForbiddenException('You can only cancel your own orders.');
    }

    // Customers can only cancel if PLACED or ACCEPTED (not yet being prepared)
    if (!['PLACED', 'ACCEPTED'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel an order with status "${order.status}". Only PLACED or ACCEPTED orders can be cancelled.`,
      );
    }

    return this.processOrderCancellation(order, 'Cancelled by customer');
  }

  // ─── MANAGER CANCEL ORDER ──────────────────────────────────────────────
  async cancelOrderByManager(orderId: string, managerId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.restaurant.managerId !== managerId) {
      throw new ForbiddenException('You do not have permission to manage this restaurant.');
    }
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel a ${order.status} order.`);
    }

    return this.processOrderCancellation(order, reason || 'Cancelled by restaurant');
  }

  // ─── SHARED CANCELLATION + AUTO-REFUND LOGIC ───────────────────────────
  private async processOrderCancellation(order: any, reason: string) {
    // 1. Cancel the order
    const cancelledOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
      },
    });

    // 2. Auto-refund if paid via wallet
    if (order.paymentMode === 'WALLET' && order.isPaid) {
      await this.walletsService.addFunds(
        order.customerId,
        order.totalAmount,
        `REFUND:${order.id}`,
      );

      // Create a Refund audit record
      await this.prisma.refund.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          reason,
          status: 'PROCESSED',
          isAuto: true,
        },
      });
    }

    // 3. Emit real-time status update
    this.eventsGateway.emitOrderStatusChange(order.id, 'CANCELLED');

    // 4. Send Push Notification
    this.notificationsService.send(
      order.customerId,
      'Order Cancelled ❌',
      `Your order was cancelled: ${reason}`,
      'ORDER_UPDATE',
      { orderId: order.id, status: 'CANCELLED' }
    ).catch(e => console.error('Failed to send order cancelled push notification', e));

    // 5. Auto-cleanup the order tracking room
    this.eventsGateway.cleanupOrderRoom(order.id);

    return cancelledOrder;
  }
}
