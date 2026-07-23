import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DriverStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunicationsService } from '../communications/communications.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly walletsService: WalletsService,
    private readonly notificationsService: NotificationsService,
    private readonly communicationsService: CommunicationsService,
    @InjectQueue('orders') private readonly orderQueue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createProfile(userId: string, dto: CreateDeliveryDto) {
    const existing = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('You already have a driver profile!');
    }

    return this.prisma.driverProfile.create({
      data: {
        userId,
        vehicleType: dto.vehicleType,
        licenseNumber: dto.licenseNumber,
        vehiclePlate: dto.vehicleLicensePlate,
      },
    });
  }
  async getProfile(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { name: true, email: true, phoneNumber: true, image: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Driver profile not found.');
    }

    // Fallback: If user's email or phone is missing, try to fetch it from their delivery request
    if (!profile.user.email || !profile.user.phoneNumber) {
      const request = await this.prisma.deliveryPartnerRequest.findUnique({
        where: { userId },
      });
      if (request) {
        if (!profile.user.email && request.email)
          profile.user.email = request.email;
        if (!profile.user.phoneNumber && request.phoneNumber)
          profile.user.phoneNumber = request.phoneNumber;
      }
    }

    return profile;
  }

  // change status ( online / offline)

  async toggleStatus(userId: string, status: DriverStatus) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Driver profile not found. Please setup profile first.',
      );
    }
    const updatedProfile = await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { status: status },
    });

    // If OFFLINE or BUSY — remove from geo index so they don't get dispatched
    if (status !== 'ONLINE') {
      await this.redis.zrem('driver_locations', userId);
    }

    return updatedProfile;
  }

  // Phase 2: Order Assignment and Completion

  async getAvailableOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');
    if (profile.status !== 'ONLINE') {
      return []; // Return empty list instead of throwing Conflict (smoother for UI)
    }

    const [pos, isActive] = await Promise.all([
      this.redis.geopos('driver_locations', userId),
      this.redis.exists(`driver_last_seen:${userId}`),
    ]);

    if (!pos || !pos[0] || !isActive) {
      throw new BadRequestException(
        'Your live location is stale or unknown. Please ensure the app is open and location is updating.',
      );
    }

    const [currentLngStr, currentLatStr] = pos[0];
    const currentLat = parseFloat(currentLatStr);
    const currentLng = parseFloat(currentLngStr);

    // 1.5 Fetch IDs of orders this driver has already declined to filter them out
    const declinedOrderIds = await this.redis.smembers(
      `declined_orders:${userId}`,
    );

    const availableOrders = await this.prisma.order.findMany({
      where: {
        status: 'READY',
        driverId: null,
        id: { notIn: declinedOrderIds },
        // Only show orders placed in the last 30 minutes to keep list clean
        placedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      include: {
        restaurant: {
          select: { name: true, address: true, lat: true, lng: true },
        },
        store: {
          select: { name: true, address: true, lat: true, lng: true },
        },
        customer: {
          select: { name: true, phoneNumber: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { placedAt: 'desc' },
    });

    // 2. Geo-Fencing Filter - Align with OrderQueueProcessor (15km)
    const MAX_DISTANCE_KM = 15;

    return availableOrders
      .map((order) => {
        // Resolve merchant (restaurant or dark store) for pickup coordinates
        const merchant = order.restaurant ?? order.store;
        if (!merchant) return null;

        const distance = this.calculateDistance(
          currentLat,
          currentLng,
          merchant.lat,
          merchant.lng,
        );

        return {
          ...order,
          distanceToRestaurantKm: parseFloat(distance.toFixed(2)),
          itemCount: order._count.items,
        };
      })
      .filter(
        (order): order is NonNullable<typeof order> =>
          order !== null && order.distanceToRestaurantKm <= MAX_DISTANCE_KM,
      );
  }

  async acceptOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true, phoneNumber: true } } },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true, store: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status === 'CANCELLED') {
      throw new ConflictException(
        'This order has been cancelled and is no longer available.',
      );
    }
    if (order.status !== 'READY' || order.driverId !== null) {
      throw new ConflictException('Order is no longer available.');
    }

    // Guard: Prevent stacking multiple active orders
    if (profile.status === DriverStatus.BUSY) {
      throw new ConflictException(
        'You are already on another delivery. Finish it first!',
      );
    }

    // Resolve merchant name (restaurant or dark store)
    const merchantName =
      order.restaurant?.name ?? order.store?.name ?? 'the merchant';

    // Atomic assignment
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: profile.id,
      },
    });

    // Make the driver BUSY so they don't get pinged for more orders
    await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { status: 'BUSY' },
    });

    // Remove from Redis geo index (BUSY drivers shouldn't be dispatched)
    await this.redis.zrem('driver_locations', userId);

    // Removed status change emission because status does not change yet.

    // 🚀 Real-time: Auto-join driver into the order tracking room
    this.eventsGateway.joinUserToOrderRoom(userId, orderId);

    // 🚀 Real-time: Notify customer + restaurant that a driver has been assigned
    this.eventsGateway.emitDriverAssigned(orderId, {
      name: profile.user.name,
      phone: profile.user.phoneNumber,
      vehiclePlate: profile.vehiclePlate,
      profilePic: profile.profilePic,
    });

    // 📱 Push notification to customer
    this.notificationsService
      .send(
        order.customerId,
        'Driver Assigned! 🛵',
        `${profile.user.name} is picking up your order from ${merchantName}.`,
        'ORDER_UPDATE',
        { orderId, status: order.status },
      )
      .catch((e) =>
        this.logger.error('Failed to send driver assigned push', e),
      );

    return updatedOrder;
  }

  async pickupOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true, phoneNumber: true } } },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }

    if (
      order.status !== 'READY' &&
      order.status !== 'ACCEPTED' &&
      order.status !== 'PREPARING'
    ) {
      throw new ConflictException(
        `Order must be PREPARING or READY to pick up. Current status: ${order.status}`,
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'ON_THE_WAY',
        pickedUpAt: new Date(),
      },
    });

    this.eventsGateway.emitOrderStatusChange(orderId, 'ON_THE_WAY');

    this.notificationsService
      .send(
        order.customerId,
        // Move the OTP to the title so it's visible instantly without expansion
        `On the way! Code: ${order.otp}`,
        // Keep the body conversational but clear
        `${profile.user.name} is arriving with your order. Please have your code ready for the rider.`,
        'ORDER_UPDATE',
        { orderId, status: 'ON_THE_WAY' },
      )
      .catch((e) =>
        this.logger.error('Failed to send order on the way push', e),
      );

    return updatedOrder;
  }

  async completeOrder(userId: string, orderId: string, otp: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: true,
        store: true,
        items: {
          include: { menuItem: true, variant: true, selectedAddons: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }

    if (order.status !== 'ON_THE_WAY') {
      throw new ConflictException('Order must be ON_THE_WAY to complete it.');
    }

    // ─── OTP brute-force protection ──────────────────────────────────────
    const otpAttemptsKey = `otp_attempts:${orderId}`;
    const MAX_OTP_ATTEMPTS = 5;
    const currentAttempts = await this.redis.get(otpAttemptsKey);
    if (currentAttempts && parseInt(currentAttempts) >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Too many failed OTP attempts. Please wait 10 minutes before trying again.',
      );
    }

    if (order.otp !== otp) {
      // Increment failed attempts with a 10 minute TTL
      await this.redis
        .multi()
        .incr(otpAttemptsKey)
        .expire(otpAttemptsKey, 600)
        .exec();
      const remaining =
        MAX_OTP_ATTEMPTS - (parseInt(currentAttempts || '0') + 1);
      throw new BadRequestException(
        `Invalid OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Account locked for 10 minutes.'}`,
      );
    }

    // OTP correct — clear the attempt counter
    await this.redis.del(otpAttemptsKey);

    const isCOD = order.paymentMode === 'COD';

    // ⚡ Atomic: mark delivered (+ mark paid if COD)
    const deliveredOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        ...(isCOD && { isPaid: true }), // COD is paid on door delivery
      },
    });

    // Increment totalDeliveries counter and make driver available again
    await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: {
        totalDeliveries: { increment: 1 },
        status: 'ONLINE',
      },
    });

    // Note: Geo index re-entry handled by next WebSocket location ping.

    // ─── DRIVER EARNINGS ──────────────────────────────────────────────────
    // All payment modes: credit driver deliveryCharge + driverTip
    const driverEarnings = order.deliveryCharge + order.driverTip;
    if (driverEarnings > 0) {
      await this.walletsService.addFunds(
        userId,
        driverEarnings,
        `DELIVERY_EARNING:${order.id}`,
        `Delivery earning of ₹${driverEarnings} for order #${order.id.slice(-6)}`,
      );
    }

    // ─── MERCHANT PAYOUT ──────────────────────────────────────────────────
    // All payment modes: credit merchant manager itemTotal + tax - commission
    // For COD: happening now because cash was just collected
    // For WALLET/online: customer already paid — merchant gets their share at delivery
    const merchantManagerId =
      order.restaurant?.managerId ?? order.store?.managerId;
    const merchantName =
      order.restaurant?.name ?? order.store?.name ?? 'merchant';
    const merchantPayout = order.itemTotal + order.tax - order.commission;
    if (merchantPayout > 0 && merchantManagerId) {
      const payoutType = isCOD
        ? `COD_MERCHANT_PAYOUT:${order.id}`
        : `MERCHANT_PAYOUT:${order.id}`;

      await this.walletsService
        .addFunds(
          merchantManagerId,
          merchantPayout,
          payoutType,
          `Payout of ₹${merchantPayout} for order #${order.id.slice(-6)}`,
        )
        .catch((e) =>
          this.logger.error(`Failed merchant payout for order ${order.id}:`, e),
        );
    }

    // ─── COD SETTLEMENT ───────────────────────────────────────────────────
    // Rider collected totalAmount cash. Because we already credited their digital
    // wallet with driverEarnings above, they owe the platform the full totalAmount
    // they collected in cash. We debit this via forceCharge (allows negative).
    if (isCOD) {
      const cashToRemit = order.totalAmount;
      if (cashToRemit > 0) {
        await this.walletsService.forceCharge(
          userId,
          cashToRemit,
          `COD_COLLECTION:${order.id}`,
          `COD cash collection of ₹${cashToRemit} for order #${order.id.slice(-6)} — remit to platform`,
        );

        // ─── GAP 1: Negative wallet floor alert ───────────────────────
        // If rider's wallet drops below -₹500, alert them via push notification
        const COD_ALERT_THRESHOLD = -500;
        try {
          const riderWallet = await this.walletsService.getBalance(userId);
          if (riderWallet.balance < COD_ALERT_THRESHOLD) {
            this.notificationsService
              .send(
                userId,
                'Cash Deposit Reminder 💰',
                `Your wallet balance is ₹${riderWallet.balance.toFixed(0)}. Please deposit your collected cash to avoid delivery restrictions.`,
                'SYSTEM',
                { walletBalance: riderWallet.balance },
              )
              .catch((e) =>
                this.logger.error('Failed to send COD wallet alert', e),
              );
          }
        } catch (e) {
          this.logger.error('Failed to check COD wallet threshold:', e);
        }
      }
    }

    this.eventsGateway.emitOrderStatusChange(orderId, 'DELIVERED');

    // 🧹 Auto-cleanup the order tracking room
    this.eventsGateway.cleanupOrderRoom(orderId);

    // 📱 Push notification to customer
    this.notificationsService
      .send(
        order.customerId,
        'Order Delivered! 🎉',
        "Enjoy your meal! Don't forget to leave a review.",
        'ORDER_UPDATE',
        { orderId, status: 'DELIVERED' },
      )
      .catch((e) =>
        this.logger.error('Failed to send delivery complete push', e),
      );

    // 📧 Send Order Delivered Email
    const deliveredCustomer = await this.prisma.user.findUnique({
      where: { id: order.customerId },
    });
    if (deliveredCustomer?.email) {
      this.communicationsService
        .queueEmail({
          to: deliveredCustomer.email,
          subject: `Order Delivered! #${orderId}`,
          template: 'order_delivered',
          event: 'ORDER_DELIVERED',
          userId: order.customerId,
          templateData: {
            userName: deliveredCustomer.name,
            orderId: orderId,
            restaurantName:
              order.restaurant?.name ?? order.store?.name ?? 'merchant',
            totalAmount: order.totalAmount,
            reviewUrl: `${process.env.CUSTOMER_APP_SCHEME}://(tabs)/orders/${orderId}?openReview=true`,
            // Bill Details
            items: order.items.map((item) => ({
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
        })
        .catch((e) =>
          this.logger.error(`Failed to queue order delivered email: ${e}`),
        );
    }

    return deliveredOrder;
  }

  // ─── DRIVER DECLINE ORDER ─────────────────────────────────────────
  async declineOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.status !== 'READY' || order.driverId !== null) {
      throw new ConflictException('Order is no longer available for decline.');
    }

    // Immediately re-dispatch to the next driver, skipping this one
    await this.orderQueue.add(
      'dispatch-order',
      { orderId, ignoredDriverIds: [userId] },
      { delay: 0 },
    );

    // Track decline in Redis so it's hidden from the available orders list
    await this.redis.sadd(`declined_orders:${userId}`, orderId);
    // Expire the decline tracking after 1 hour (orders are likely cancelled by then anyway)
    await this.redis.expire(`declined_orders:${userId}`, 3600);

    return {
      message:
        'Order declined. It will be offered to the next available driver.',
    };
  }

  // ─── DRIVER CANCEL ACTIVE ORDER ───────────────────────────────────
  async cancelOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.driverId !== profile.id) {
      throw new ForbiddenException('You are not assigned to this order.');
    }

    // You can only cancel if you haven't picked it up yet (standard policy)
    if (order.status !== 'READY' && order.status !== 'ACCEPTED') {
      throw new ConflictException(
        `Cannot cancel order in status: ${order.status}`,
      );
    }

    // Release the order
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          driverId: null,
          status: 'READY',
        },
      }),
      this.prisma.driverProfile.update({
        where: { id: profile.id },
        data: { status: 'ONLINE' },
      }),
    ]);

    // Re-dispatch into the queue immediately
    await this.orderQueue.add(
      'dispatch-order',
      { orderId, ignoredDriverIds: [userId] }, // Skip this driver during re-dispatch
      { delay: 0 },
    );

    this.eventsGateway.emitOrderStatusChange(orderId, 'READY');

    // 🚀 NEW: Notify Merchant Manager (Restaurant or Store)
    const merchantId = order.restaurantId ?? order.storeId;
    if (merchantId) {
      const merchant = order.restaurantId
        ? await this.prisma.restaurant.findUnique({
            where: { id: order.restaurantId },
          })
        : order.storeId
          ? await this.prisma.store.findUnique({ where: { id: order.storeId } })
          : null;

      if (merchant) {
        this.notificationsService
          .send(
            merchant.managerId,
            'Rider Released Order ⚠️',
            `The rider assigned to order #${orderId.slice(-6)} is no longer available. We are assigning a new one now.`,
            'ORDER_UPDATE',
            { orderId, status: 'READY' },
          )
          .catch((e) =>
            this.logger.error('Failed to notify merchant of rider release', e),
          );

        // Update merchant live dashboard
        const roomPrefix = order.restaurantId ? 'restaurant' : 'store';
        this.eventsGateway.server
          .to(`${roomPrefix}_${merchantId}`)
          .emit('rider_released', { orderId });
      }
    }

    // 🚀 NEW: Notify Customer
    this.notificationsService
      .send(
        order.customerId,
        'Rider Update 🛵',
        'Your assigned rider is no longer available. We are looking for a replacement now!',
        'ORDER_UPDATE',
        { orderId, status: 'READY' },
      )
      .catch((e) =>
        this.logger.error('Failed to notify customer of rider release', e),
      );

    return { message: 'Delivery cancelled and released for other drivers.' };
  }

  // ─── GET MY CURRENT ORDER ──────────────────────────────────────────────
  async getMyCurrentOrder(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        driverId: profile.id,
        status: { in: ['READY', 'PICKED_UP', 'ON_THE_WAY'] },
      },
      include: {
        restaurant: {
          select: {
            name: true,
            address: true,
            lat: true,
            lng: true,
            image: true,
          },
        },
        customer: {
          select: { name: true, phoneNumber: true },
        },
        items: {
          include: { menuItem: true, variant: true, selectedAddons: true },
        },
      },
    });

    if (!activeOrder) {
      // Self-healing: If driver is stuck in BUSY but has no orders, reset them to ONLINE
      if (profile.status === 'BUSY') {
        this.logger.log(
          `[Self-Healing] Driver ${userId} was stuck in BUSY with no active orders. Resetting to ONLINE.`,
        );
        await this.prisma.driverProfile.update({
          where: { id: profile.id },
          data: { status: 'ONLINE' },
        });
      }
      return { message: 'No active delivery at the moment.', order: null };
    }

    return { order: activeOrder };
  }

  // ─── GET MY EARNINGS SUMMARY ───────────────────────────────────────────
  async getMyEarnings(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    // Time range helpers
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
    );
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    // Fetch today's delivered orders for this driver
    const todayOrders = await this.prisma.order.findMany({
      where: {
        driverId: profile.id,
        status: 'DELIVERED',
        deliveredAt: { gte: todayStart },
      },
      select: {
        deliveryCharge: true,
        driverTip: true,
      },
    });

    // Fetch this week's delivered orders
    const weekOrders = await this.prisma.order.findMany({
      where: {
        driverId: profile.id,
        status: 'DELIVERED',
        deliveredAt: { gte: weekStart },
      },
      select: {
        deliveryCharge: true,
        driverTip: true,
      },
    });

    // Calculate aggregates
    const todayDeliveryPay = todayOrders.reduce(
      (sum, o) => sum + o.deliveryCharge,
      0,
    );
    const todayTips = todayOrders.reduce((sum, o) => sum + o.driverTip, 0);
    const todayEarnings = todayDeliveryPay + todayTips;
    const weeklyEarnings = weekOrders.reduce(
      (sum, o) => sum + o.deliveryCharge + o.driverTip,
      0,
    );

    // Wallet balance
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    return {
      // Lifetime
      totalDeliveries: profile.totalDeliveries,
      rating: profile.rating,
      ratingCount: profile.ratingCount,
      // Today
      todayDeliveries: todayOrders.length,
      todayEarnings: parseFloat(todayEarnings.toFixed(2)),
      todayDeliveryPay: parseFloat(todayDeliveryPay.toFixed(2)),
      todayTips: parseFloat(todayTips.toFixed(2)),
      // This Week
      weeklyDeliveries: weekOrders.length,
      weeklyEarnings: parseFloat(weeklyEarnings.toFixed(2)),
      // Wallet
      walletBalance: parseFloat((wallet?.balance ?? 0).toFixed(2)),
    };
  }

  // ─── GET ORDER ROUTE ───────────────────────────────────────────────────
  async getOrderRoute(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Driver profile not found.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: { name: true, address: true, lat: true, lng: true },
        },
        store: {
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

    // Resolve merchant (restaurant or dark store) for pickup coordinates
    const merchant = order.restaurant ?? order.store;
    if (!merchant) {
      throw new NotFoundException('Merchant details not found for this order.');
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
        name: merchant.name,
        address: merchant.address,
        lat: merchant.lat,
        lng: merchant.lng,
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
        merchant.lat,
        merchant.lng,
        customerAddress.lat,
        customerAddress.lng,
      ).toFixed(2),
    };
  }

  // ─── BACKGROUND LOCATION SYNC ──────────────────────────────────────────
  async syncLocation(
    userId: string,
    lat: number,
    lng: number,
    orderId?: string,
  ) {
    let profileId = await this.redis.get(`driver_profile:${userId}`);

    if (!profileId) {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!profile) throw new NotFoundException('Driver profile not found.');
      profileId = profile.id;
      await this.redis.set(`driver_profile:${userId}`, profileId, 'EX', 3600); // Cache for 1 hour
    }

    // 1. Update Redis index
    await this.redis.geoadd('driver_locations', lng, lat, userId);
    await this.redis.setex(`driver_last_seen:${userId}`, 600, 'active');

    // 2. If an orderId is provided (or if tracking active delivery), emit via socket
    if (orderId) {
      this.eventsGateway.server
        .to(`order_${orderId}`)
        .emit('order_location_update', {
          orderId,
          driverProfileId: profileId,
          lat,
          lng,
        });
    }

    return { success: true };
  }

  // Helper function to calculate distance in km
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
