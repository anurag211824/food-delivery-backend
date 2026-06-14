import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { CommunicationsService } from '../communications/communications.service';

/** Reusable deep include for order items */
const ORDER_ITEMS_INCLUDE = {
  items: {
    include: {
      menuItem: true,
      variant: true,
      selectedAddons: true,
    },
  },
} as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private eventsGateway: EventsGateway,
    private couponsService: CouponsService,
    private notificationsService: NotificationsService,
    private communicationsService: CommunicationsService,
    @InjectQueue('orders') private orderQueue: Queue,
  ) { }

  async create(userId: string, dto: CreateOrderDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) throw new NotFoundException("Restaurant not found");
    if (!restaurant.isOpen) throw new BadRequestException("Restaurant is closed");

    const userAddress = dto.addressId
      ? await this.prisma.address.findUnique({ where: { id: dto.addressId, userId } })
      : await this.prisma.address.findFirst({ where: { userId, isDefault: true } });

    if (!userAddress) {
      throw new BadRequestException("Delivery address not found. Please add an address first.");
    }

    // ─── Fetch all menu items with their variants and addon options ────────
    const menuItemIds = dto.items.map(i => i.menuItemId);
    const dbItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        category: { restaurantId: dto.restaurantId },
      },
      include: {
        variants: true,
        addons: { include: { options: true } },
      },
    });

    if (dbItems.length !== new Set(menuItemIds).size) {
      throw new BadRequestException("Some items are invalid or don't belong to this restaurant.");
    }

    // ─── Validate & calculate each line item ──────────────────────────────
    let itemTotal = 0;
    const orderItemsData: any[] = [];

    for (const item of dto.items) {
      const dbItem = dbItems.find(d => d.id === item.menuItemId);
      if (!dbItem) throw new BadRequestException(`Menu item ${item.menuItemId} not found.`);
      if (!dbItem.isAvailable) throw new BadRequestException(`"${dbItem.name}" is currently unavailable.`);

      // ── Resolve variant ─────────────────────────────────────────────────
      let variant: any;
      if (item.variantId) {
        variant = dbItem.variants.find(v => v.id === item.variantId);
        if (!variant) throw new BadRequestException(`Variant ${item.variantId} does not belong to "${dbItem.name}".`);
      } else if (dbItem.variants.length > 0) {
        variant = dbItem.variants.find(v => v.isDefault) || dbItem.variants[0];
      }

      if (!variant) {
        throw new BadRequestException(`"${dbItem.name}" has no pricing variant configured.`);
      }
      if (!variant.isAvailable) {
        throw new BadRequestException(`Variant "${variant.name}" for "${dbItem.name}" is currently unavailable.`);
      }

      const unitPrice = variant.salePrice ?? variant.price;

      // ── Resolve addons ──────────────────────────────────────────────────
      let addonsPrice = 0;
      const addonSnapshots: any[] = [];

      if (item.selectedAddons && item.selectedAddons.length > 0) {
        const allOptions = dbItem.addons.flatMap(g => g.options);

        for (const sel of item.selectedAddons) {
          const option = allOptions.find(o => o.id === sel.addonOptionId);
          if (!option) {
            throw new BadRequestException(`Addon option ${sel.addonOptionId} does not belong to "${dbItem.name}".`);
          }
          if (!option.isAvailable) {
            throw new BadRequestException(`Addon "${option.name}" is currently unavailable.`);
          }
          const qty = sel.quantity ?? 1;
          addonsPrice += option.price * qty;
          addonSnapshots.push({
            addonOptionId: option.id,
            name: option.name,
            price: option.price,
            quantity: qty,
          });
        }
      }

      const lineTotal = (unitPrice + addonsPrice) * item.quantity;
      itemTotal += lineTotal;

      orderItemsData.push({
        menuItemId: dbItem.id,
        variantId: variant.id,
        quantity: item.quantity,
        itemName: dbItem.name,
        variantName: variant.name,
        unitPrice,
        addonsPrice,
        totalPrice: lineTotal,
        selectedAddons: {
          create: addonSnapshots,
        },
      });
    }

    // ─── Compute order totals ─────────────────────────────────────────────
    let deliveryCharge = 30;
    if (userAddress && restaurant.lat && restaurant.lng) {
      const distanceKm = this.calculateDistance(
        userAddress.lat, userAddress.lng,
        restaurant.lat, restaurant.lng,
      );
      deliveryCharge = Math.min(60, Math.round(15 + distanceKm * 7));
    }

    let discount = 0;
    if (dto.promoCode) {
      const result = await this.couponsService.validate(dto.promoCode, userId, itemTotal);
      discount = result.discount;
    }

    const commission = Math.round(itemTotal * 0.20 * 100) / 100;
    const tax = Math.round(itemTotal * 0.05 * 100) / 100;
    const platformFee = 5;
    const driverTip = dto.driverTip ?? 0;
    const totalAmount = Math.round((itemTotal + tax + deliveryCharge + platformFee + driverTip - discount) * 100) / 100;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ─── Create order atomically ──────────────────────────────────────────
    const order = await this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId: userId,
          restaurantId: dto.restaurantId,
          status: 'PLACED',
          otp,
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
          addressId: userAddress.id,
          deliveryAddressLine: userAddress.addressLine,
          deliveryLandmark: userAddress.landmark,
          deliveryReceiverName: userAddress.receiverName,
          deliveryReceiverPhone: userAddress.receiverPhone,
          deliveryLat: userAddress.lat,
          deliveryLng: userAddress.lng,
          items: {
            create: orderItemsData,
          },
        },
        include: ORDER_ITEMS_INCLUDE,
      });
    });

    // ─── Post-creation steps (wallet, coupon, notifications) ──────────────
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

    if (dto.promoCode && discount > 0) {
      await this.couponsService.recordUsage(dto.promoCode, userId, order.id);
    }

    if (order.isPaid || order.paymentMode === PaymentMethod.COD) {
      this.notificationsService.send(
        restaurant.managerId,
        '🔔 New Order!',
        `A new order of ₹${totalAmount} has been placed.`,
        'ORDER_UPDATE',
        { orderId: order.id },
      ).catch(e => this.logger.error('Failed to send push notification to restaurant', e));

      this.eventsGateway.emitNewOrderToRestaurant(restaurant.id, {
        orderId: order.id,
        totalAmount,
        itemCount: order.items.length,
        paymentMode: dto.paymentMode,
        timestamp: new Date().toISOString(),
      });
    }

    this.eventsGateway.joinUserToOrderRoom(userId, order.id);

    if (!order.isPaid && order.paymentMode !== 'COD') {
      await this.orderQueue.add(
        'cancel-unpaid-order',
        { orderId: order.id },
        { delay: 10 * 60 * 1000 },
      );
    }

    await this.orderQueue.add(
      'cancel-stale-placed-order',
      { orderId: order.id },
      { delay: 10 * 60 * 1000 },
    );

    return order;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
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
        restaurant: true,
        ...ORDER_ITEMS_INCLUDE,
      }
    });

    if (!order) throw new NotFoundException("Order not found");

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
      },
      include: ORDER_ITEMS_INCLUDE,
    });

    this.eventsGateway.emitOrderStatusChange(orderId, status);

    let title = 'Order Update';
    let body = `Your order is now ${status}`;

    if (status === 'ACCEPTED') {
      title = 'Order Accepted! 🍔';
      body = 'The restaurant has accepted your order and is preparing it.';
    } else if (status === 'READY') {
      title = 'Order is Ready! 🛍️';
      body = 'The restaurant has finished preparing your order. Assigning a delivery partner...';

      this.orderQueue.add(
        'dispatch-order',
        { orderId: orderId, ignoredDriverIds: [], attemptCount: 0 },
        { jobId: `dispatch-${orderId}`, removeOnComplete: true }
      ).catch(e => this.logger.error('Failed to trigger auto-dispatch', e));

    } else if (status === 'ON_THE_WAY') {
      title = 'Out for Delivery! 🛵';
      body = 'Your food is on the way to you.';
    } else if (status === 'DELIVERED') {
      title = 'Order Delivered! 🎉';
      body = 'Enjoy your meal!';

      const deliveredCustomer = await this.prisma.user.findUnique({ where: { id: order.customerId } });
      if (deliveredCustomer?.email) {
        this.communicationsService.queueEmail({
          to: deliveredCustomer.email,
          subject: `Order Delivered! #${orderId}`,
          template: 'order_delivered',
          event: 'ORDER_DELIVERED',
          userId: order.customerId,
          templateData: {
            userName: deliveredCustomer.name,
            orderId: orderId,
            restaurantName: order.restaurant.name,
            totalAmount: order.totalAmount,
            reviewUrl: `${process.env.CUSTOMER_APP_SCHEME}://(tabs)/orders/${orderId}?openReview=true`,
            items: order.items.map(item => ({
              name: item.itemName,
              quantity: item.quantity,
              price: item.totalPrice,
            })),
            itemTotal: order.itemTotal,
            tax: order.tax,
            deliveryCharge: order.deliveryCharge,
            platformFee: order.platformFee,
            discount: order.discount,
            driverTip: order.driverTip,
          },
        }).catch(e => this.logger.error(`Failed to queue order delivered email: ${e}`));
      }
    } else if (status === 'CANCELLED') {
      title = 'Order Cancelled ❌';
      body = 'Your order has been cancelled.';
    }

    this.notificationsService.send(
      order.customerId,
      title,
      body,
      'ORDER_UPDATE',
      { orderId, status }).catch(e => this.logger.error('Failed to send order update push notification', e));

    if (['DELIVERED', 'CANCELLED', 'REFUSED'].includes(status)) {
      this.eventsGateway.cleanupOrderRoom(orderId);
    }

    return updatedOrder;
  }

  async bulkUpdateStatus(orderIds: string[], status: OrderStatus, actor: Pick<User, 'id' | 'role'>) {
    const results: any[] = [];
    const errors: any[] = [];

    for (const orderId of orderIds) {
      try {
        const updated = await this.updateStatus(orderId, status, actor);
        results.push(updated);
      } catch (error) {
        errors.push({
          orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new BadRequestException({
        message: 'All bulk updates failed',
        errors,
      });
    }

    return {
      successCount: results.length,
      failCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async getOrderById(orderId: string, actor?: Pick<User, 'id' | 'role'>) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: {
          include: {
            user: {
              select: { name: true, phoneNumber: true }
            }
          }
        },
        ...ORDER_ITEMS_INCLUDE,
        restaurant: true,
        customer: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            image: true
          }
        },
        review: true
      }
    });

    if (!order) throw new NotFoundException("Order not found");

    if (actor) {
      const isCustomer = order.customerId === actor.id;
      const isManager = order.restaurant.managerId === actor.id;
      const isDriver = order.driver?.userId === actor.id;
      const isAdmin = actor.role === Role.ADMIN;

      if (!isCustomer && !isManager && !isDriver && !isAdmin) {
        throw new ForbiddenException('You do not have permission to view this order.');
      }
    }

    const customerAddress = {
      addressLine: order.deliveryAddressLine,
      landmark: order.deliveryLandmark,
      receiverName: order.deliveryReceiverName,
      receiverPhone: order.deliveryReceiverPhone,
      lat: order.deliveryLat,
      lng: order.deliveryLng,
    };

    const driver = order.driver ? {
      id: order.driver.id,
      name: order.driver.user.name,
      phone: order.driver.user.phoneNumber,
      vehiclePlate: order.driver.vehiclePlate,
      profilePic: order.driver.profilePic,
      currentLat: order.driver.currentLat,
      currentLng: order.driver.currentLng,
    } : null;

    return {
      ...order,
      driver,
      customerAddress
    };
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
          select: {
            id: true,
            user: { select: { name: true, phoneNumber: true } },
            vehiclePlate: true,
            profilePic: true,
            currentLat: true,
            currentLng: true,
          }
        },
        ...ORDER_ITEMS_INCLUDE,
      },
      orderBy: { placedAt: 'desc' }
    });

    if (!currentOrder) {
      throw new NotFoundException("No active order found");
    }

    const driver = currentOrder.driver ? {
      id: currentOrder.driver.id,
      name: currentOrder.driver.user.name,
      phone: currentOrder.driver.user.phoneNumber,
      vehiclePlate: currentOrder.driver.vehiclePlate,
      profilePic: currentOrder.driver.profilePic,
      currentLat: currentOrder.driver.currentLat,
      currentLng: currentOrder.driver.currentLng,
    } : null;

    const customerAddress = {
      addressLine: currentOrder.deliveryAddressLine,
      landmark: currentOrder.deliveryLandmark,
      receiverName: currentOrder.deliveryReceiverName,
      receiverPhone: currentOrder.deliveryReceiverPhone,
      lat: currentOrder.deliveryLat,
      lng: currentOrder.deliveryLng,
    };

    return {
      ...currentOrder,
      driver,
      customerAddress
    };
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
          ...ORDER_ITEMS_INCLUDE,
        },
        orderBy: { placedAt: 'desc' }
      }),
      this.prisma.order.count({ where: { customerId: userId } })
    ]);

    return { data, meta: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) } };
  }

  async getRestaurantOrders(user: Pick<User, 'id' | 'role'>, dto: PaginationDto, status?: OrderStatus, restaurantId?: string) {
    const pageNumber = dto.page || 1;
    const limitNumber = dto.limit || 10;
    const skip = (pageNumber - 1) * limitNumber;

    let where: any = {};

    if (user.role === Role.ADMIN && restaurantId) {
      where = { restaurantId: restaurantId };
    } else {
      where = {
        restaurant: {
          managerId: user.id,
        }
      };
    }

    if (status) {
      where.status = status;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limitNumber,
        include: {
          customer: {
            select: { id: true, name: true, email: true, phoneNumber: true },
          },
          ...ORDER_ITEMS_INCLUDE,
          driver: {
            include: { user: { select: { name: true, phoneNumber: true } } }
          }
        },
        orderBy: { placedAt: 'desc' },
      }),
      this.prisma.order.count({ where })
    ]);

    const data = rawData.map(order => {
      const customerAddress = {
        addressLine: order.deliveryAddressLine,
        landmark: order.deliveryLandmark,
        receiverName: order.deliveryReceiverName,
        receiverPhone: order.deliveryReceiverPhone,
        lat: order.deliveryLat,
        lng: order.deliveryLng,
      };

      const driver = order.driver ? {
        ...order.driver,
        phone: order.driver.user.phoneNumber,
        name: order.driver.user.name,
      } : null;

      return {
        ...order,
        customerAddress,
        driver
      };
    });

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

    if (!['PLACED', 'ACCEPTED'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel an order with status "${order.status}". Only PLACED or ACCEPTED orders can be cancelled.`,
      );
    }

    return this.processOrderCancellation(order, 'Cancelled by customer');
  }

  // ─── MANAGER CANCEL ORDER ──────────────────────────────────────────────
  async cancelOrderByManager(orderId: string, user: Pick<User, 'id' | 'role'>, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (user.role !== Role.ADMIN && order.restaurant.managerId !== user.id) {
      throw new ForbiddenException('You do not have permission to manage this restaurant.');
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel a ${order.status} order.`);
    }

    return this.processOrderCancellation(order, reason || 'Cancelled by restaurant');
  }

  // ─── SHARED CANCELLATION + AUTO-REFUND LOGIC ───────────────────────────
  private async processOrderCancellation(order: any, reason: string) {
    if (order.status === 'DELIVERED') {
      throw new BadRequestException('Cannot cancel a DELIVERED order. Financial settlement has already occurred.');
    }

    const cancelledOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
      },
      include: {
        driver: true,
      }
    });

    if (order.paymentMode === 'WALLET' && order.isPaid) {
      await this.walletsService.addFunds(
        order.customerId,
        order.totalAmount,
        `REFUND:${order.id}`,
      );

      await this.prisma.refund.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          reason,
          status: 'PROCESSED',
          isAuto: true,
        },
      });

      const refundCustomer = await this.prisma.user.findUnique({ where: { id: order.customerId } });
      if (refundCustomer?.email) {
        this.communicationsService.queueEmail({
          to: refundCustomer.email,
          subject: `Refund Processed for Order #${order.id}`,
          template: 'refund_processed',
          event: 'REFUND_PROCESSED',
          userId: order.customerId,
          templateData: {
            userName: refundCustomer.name,
            refundAmount: order.totalAmount,
            orderId: order.id,
            reason,
          },
        }).catch(e => this.logger.error(`Failed to queue refund email: ${e}`));
      }
    }

    if (order.driverId) {
      await this.prisma.driverProfile.update({
        where: { id: order.driverId },
        data: { status: 'ONLINE' }
      });

      const driverUserId = cancelledOrder.driver?.userId;
      if (driverUserId) {
        this.notificationsService.send(
          driverUserId,
          'Order VOIDED ❌',
          `The active order #${order.id.slice(-6)} was cancelled by the customer/restaurant.`,
          'ORDER_UPDATE',
          { orderId: order.id, status: 'CANCELLED' }
        ).catch(e => this.logger.error('Failed to notify driver of cancellation', e));

        this.eventsGateway.server.to(`user_${driverUserId}`).emit('order_cancelled', {
          orderId: order.id,
          reason
        });
      }
    }

    this.eventsGateway.emitOrderStatusChange(order.id, 'CANCELLED');

    this.notificationsService.send(
      order.customerId,
      'Order Cancelled ❌',
      `Your order was cancelled: ${reason}`,
      'ORDER_UPDATE',
      { orderId: order.id, status: 'CANCELLED' }
    ).catch(e => this.logger.error('Failed to send order cancelled push notification', e));

    this.eventsGateway.cleanupOrderRoom(order.id);

    return cancelledOrder;
  }
}
