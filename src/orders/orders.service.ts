import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { WalletsService } from '../wallets/wallets.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private eventsGateway: EventsGateway,
  ) { }

  async create(userId: string, dto: CreateOrderDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) throw new NotFoundException("Restaurant not found");
    if (!restaurant.isOpen) throw new BadRequestException("Restaurant is closed");

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

    const tax = itemTotal * 0.05;
    const deliveryCharge = 30;
    const platformFee = 5;
    const totalAmount = itemTotal + tax + deliveryCharge + platformFee;

    // Generate a simple 4 digit OTP for delivery verification
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // ─── Step 1: Create the order atomically (no wallet call inside) ──────────
    // Keeping wallet charge OUTSIDE the transaction fixes P2028 timeout errors.
    // WalletsService.charge() opens its own transaction, nesting it caused 7s+ delays.
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
          totalAmount,
          paymentMode: dto.paymentMode,
          isPaid: false, // Will be set true after successful wallet charge below
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
        // Mark order as paid now that charge succeeded
        await this.prisma.order.update({
          where: { id: order.id },
          data: { isPaid: true },
        });
        order.isPaid = true;
      } catch (err) {
        // Compensate: cancel the order if wallet charge fails
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancellationReason: 'Insufficient wallet balance' },
        });
        throw err; // Re-throw so the client gets the correct error
      }
    }

    return order;
  }

  async updateStatus(orderId: string, status: OrderStatus, managerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: true
      }
    });

    if (!order) throw new NotFoundException("Order not found");

    if (order.restaurant.managerId !== managerId) {
      throw new ForbiddenException("You do not have permission to manage this restaurant")
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : undefined,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      }
    });

    // 🚀 Real-time event!
    this.eventsGateway.emitOrderStatusChange(orderId, status);

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

  async getCustomerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: {
        restaurant: {
          select: { name: true, image: true, id: true }
        },
        items: {
          include: { menuItem: true }
        }
      },
      orderBy: { placedAt: 'desc' }
    });
  }

  async getRestaurantOrders(managerId: string) {
    return this.prisma.order.findMany({
      where: {
        restaurant: {
          managerId: managerId,
        }
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: { menuItem: true },
        },
      },
      orderBy: { placedAt: 'desc' },
    })
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

    return cancelledOrder;
  }
}
