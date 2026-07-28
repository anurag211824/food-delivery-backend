import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PickerStatus, Role, User, Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { auth } from '../lib/auth';
import { StatsPeriod } from '../restaurants/dto/get-stats.dto';

@Injectable()
export class StoreManagementService {
  private readonly logger = new Logger(StoreManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── ADD A PICKER TO THE STORE ──────────────────────────────────────────
  async addPicker(
    storeId: string,
    managerId: string,
    dto: { userId: string; name: string },
  ) {
    // 1. Verify the store belongs to the requesting manager
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Store not found.');
    if (store.managerId !== managerId) {
      throw new ForbiddenException('You do not manage this store.');
    }

    // 2. Verify the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException(`User "${dto.userId}" not found.`);

    // 3. Check if user is already a picker somewhere
    const existingPicker = await this.prisma.storePicker.findUnique({
      where: { userId: dto.userId },
    });
    if (existingPicker) {
      throw new BadRequestException(
        'This user is already registered as a picker at a store.',
      );
    }

    // 4. Create the picker and promote user role
    const picker = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dto.userId },
        data: { role: Role.STORE_PICKER },
      });

      return tx.storePicker.create({
        data: {
          storeId,
          userId: dto.userId,
          name: dto.name,
          status: PickerStatus.OFFLINE,
        },
      });
    });

    this.logger.log(
      `Picker "${dto.name}" (${dto.userId}) added to store ${storeId}`,
    );
    return { message: 'Picker added successfully.', picker };
  }

  // ─── REMOVE A PICKER FROM THE STORE ─────────────────────────────────────
  async removePicker(storeId: string, pickerId: string, managerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Store not found.');
    if (store.managerId !== managerId) {
      throw new ForbiddenException('You do not manage this store.');
    }

    const picker = await this.prisma.storePicker.findUnique({
      where: { id: pickerId },
    });
    if (!picker || picker.storeId !== storeId) {
      throw new NotFoundException('Picker not found in this store.');
    }

    if (picker.activeOrderCount > 0) {
      throw new BadRequestException(
        `This picker has ${picker.activeOrderCount} active orders. Reassign or complete them first.`,
      );
    }

    // Unassign orders and delete picker
    await this.prisma.$transaction(async (tx) => {
      // Unassign any leftover orders (safety net)
      await tx.order.updateMany({
        where: { pickerId: picker.id },
        data: { pickerId: null },
      });

      await tx.storePicker.delete({ where: { id: pickerId } });

      // Downgrade role back to CUSTOMER
      await tx.user.update({
        where: { id: picker.userId },
        data: { role: Role.CUSTOMER },
      });
    });

    return { message: 'Picker removed successfully.' };
  }

  // ─── LIST ALL PICKERS FOR A STORE ───────────────────────────────────────
  async listPickers(storeId: string, managerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Store not found.');
    if (store.managerId !== managerId) {
      throw new ForbiddenException('You do not manage this store.');
    }

    const pickers = await this.prisma.storePicker.findMany({
      where: { storeId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phoneNumber: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pickers;
  }

  // ─── UPDATE PICKER STATUS (Picker calls this themselves) ────────────────
  async updatePickerStatus(userId: string, status: PickerStatus) {
    const picker = await this.prisma.storePicker.findUnique({
      where: { userId },
    });
    if (!picker)
      throw new NotFoundException('You are not registered as a picker.');

    // Cannot go AVAILABLE if you have active orders — must finish them first
    if (status === PickerStatus.AVAILABLE && picker.activeOrderCount > 0) {
      // This is fine — they can be available and still have orders in PREPARING
    }

    const updated = await this.prisma.storePicker.update({
      where: { id: picker.id },
      data: { status },
    });

    return { message: `Status updated to ${status}.`, picker: updated };
  }

  // ─── GET PICKER'S ASSIGNED ORDERS ───────────────────────────────────────
  async getPickerOrders(userId: string) {
    const picker = await this.prisma.storePicker.findUnique({
      where: { userId },
    });
    if (!picker)
      throw new NotFoundException('You are not registered as a picker.');

    const orders = await this.prisma.order.findMany({
      where: {
        pickerId: picker.id,
        status: { in: ['ACCEPTED', 'PREPARING'] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { placedAt: 'asc' }, // Oldest first (FIFO)
    });

    return orders;
  }

  // ─── AUTO-ASSIGN ORDER TO LEAST-BUSY PICKER ────────────────────────────
  // Called internally when a grocery order transitions to ACCEPTED
  async autoAssignPicker(
    orderId: string,
    storeId: string,
  ): Promise<string | null> {
    // Find the least-busy AVAILABLE picker at this store
    const availablePicker = await this.prisma.storePicker.findFirst({
      where: {
        storeId,
        status: { in: [PickerStatus.AVAILABLE, PickerStatus.PICKING] },
      },
      orderBy: { activeOrderCount: 'asc' }, // Least-busy first
    });

    if (!availablePicker) {
      this.logger.warn(
        `No available pickers at store ${storeId} for order ${orderId}. Order stays unassigned.`,
      );
      return null;
    }

    // Assign the order and bump the picker's active count
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { pickerId: availablePicker.id },
      });

      await tx.storePicker.update({
        where: { id: availablePicker.id },
        data: {
          activeOrderCount: { increment: 1 },
          status: PickerStatus.PICKING, // Auto-transition to PICKING
        },
      });
    });

    // Notify the picker via WebSocket
    this.eventsGateway.server
      .to(`user_${availablePicker.userId}`)
      .emit('picker:new-order', {
        orderId,
        message: 'New order assigned to you!',
      });

    this.logger.log(
      `Order ${orderId} auto-assigned to picker ${availablePicker.name} (${availablePicker.id})`,
    );
    // Notify the picker via Expo Push Notification
    this.notificationsService.send(
      availablePicker.userId,
      'New Packing Task 📦',
      'You have been assigned a new store order to pack!',
      'PICKER_TASK',
      { orderId, storeId }
    ).catch(e => this.logger.error(`Failed to send push notification to picker ${availablePicker.userId}:`, e));

    this.logger.log(`Order ${orderId} auto-assigned to picker ${availablePicker.name} (${availablePicker.id})`);
    return availablePicker.id;
  }

  // ─── COMPLETE PICKING (Picker marks order as READY) ─────────────────────
  // Called when a picker finishes packing — decrements their active count
  async completePickingForOrder(orderId: string, pickerId: string) {
    await this.prisma.$transaction(async (tx) => {
      const picker = await tx.storePicker.findUnique({
        where: { id: pickerId },
      });
      if (!picker) return;

      const newActiveCount = Math.max(0, picker.activeOrderCount - 1);
      await tx.storePicker.update({
        where: { id: pickerId },
        data: {
          activeOrderCount: newActiveCount,
          totalOrdersPicked: { increment: 1 },
          // If no more active orders, go back to AVAILABLE
          status:
            newActiveCount === 0
              ? PickerStatus.AVAILABLE
              : PickerStatus.PICKING,
        },
      });
    });
  }

  // ─── RELEASE PICKER FROM CANCELLED ORDER ────────────────────────────────
  // Called when an assigned order gets cancelled
  async releasePickerFromOrder(orderId: string, pickerId: string) {
    await this.prisma.$transaction(async (tx) => {
      const picker = await tx.storePicker.findUnique({
        where: { id: pickerId },
      });
      if (!picker) return;

      const newActiveCount = Math.max(0, picker.activeOrderCount - 1);
      await tx.storePicker.update({
        where: { id: pickerId },
        data: {
          activeOrderCount: newActiveCount,
          status:
            newActiveCount === 0
              ? PickerStatus.AVAILABLE
              : PickerStatus.PICKING,
        },
      });

      // Clear the picker assignment on the order
      await tx.order.update({
        where: { id: orderId },
        data: { pickerId: null },
      });
    });
  }

  // ─── STORE MANAGER DASHBOARD: LIVE OVERVIEW ─────────────────────────────
  async getStoreDashboard(storeId: string, managerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Store not found.');
    if (store.managerId !== managerId) {
      throw new ForbiddenException('You do not manage this store.');
    }

    const [pickers, activeOrders, todayCompleted] = await Promise.all([
      // All pickers with their current status and load
      this.prisma.storePicker.findMany({
        where: { storeId },
        select: {
          id: true,
          name: true,
          status: true,
          activeOrderCount: true,
          totalOrdersPicked: true,
        },
        orderBy: { name: 'asc' },
      }),
      // All active (non-terminal) grocery orders at this store
      this.prisma.order.count({
        where: {
          storeId,
          status: { in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
      }),
      // Orders completed today
      this.prisma.order.count({
        where: {
          storeId,
          status: 'DELIVERED',
          deliveredAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const availablePickers = pickers.filter(
      (p) => p.status === PickerStatus.AVAILABLE,
    ).length;
    const pickingPickers = pickers.filter(
      (p) => p.status === PickerStatus.PICKING,
    ).length;

    return {
      store: { id: store.id, name: store.name, isOpen: store.isOpen },
      stats: {
        totalPickers: pickers.length,
        availablePickers,
        pickingPickers,
        activeOrders,
        todayCompleted,
      },
      pickers,
    };
  }

  // ─── CREATE PICKER WITH CREDENTIALS (IAM-Style) ────────────────────────
  // Store Manager creates a new user account + picker profile in one step
  async createPickerWithCredentials(
    storeId: string,
    managerId: string,
    dto: { name: string; email: string; password: string },
  ) {
    // 1. Verify the store belongs to the requesting manager
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Store not found.');
    if (store.managerId !== managerId) {
      throw new ForbiddenException('You do not manage this store.');
    }

    // 2. Create user account via Better Auth
    const response = await auth.api.signUpEmail({
      body: {
        email: dto.email,
        password: dto.password,
        name: dto.name,
      },
    });

    if (!response || !response.user) {
      throw new BadRequestException(
        'Failed to create picker account. Email may already be in use.',
      );
    }

    // 3. Atomically promote to STORE_PICKER and create StorePicker profile
    const picker = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: response.user.id },
        data: {
          role: Role.STORE_PICKER,
          emailVerified: true, // Manager-created accounts are trusted
        },
      });

      return tx.storePicker.create({
        data: {
          storeId,
          userId: response.user.id,
          name: dto.name,
          status: PickerStatus.OFFLINE,
        },
      });
    });

    this.logger.log(
      `Picker account "${dto.name}" created and linked to store ${store.name}`,
    );
    return {
      message:
        'Picker account created successfully. Share the login credentials with the picker.',
      picker,
      credentials: { email: dto.email, name: dto.name },
    };
  }

  // ─── GET MY STORE (For Store Manager) ───────────────────────────────────
  async getMyStore(managerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { managerId },
      include: {
        _count: {
          select: {
            pickers: true,
            inventory: true,
            categories: true,
            orders: true,
          },
        },
      },
    });

    if (!store) throw new NotFoundException('You do not have a store profile.');
    return store;
  }

  // ─── UPDATE STORE PROFILE ──────────────────────────────────────────────
  async updateStoreProfile(
    managerId: string,
    dto: {
      name?: string;
      description?: string;
      logo?: string;
      banner?: string;
      address?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    const store = await this.prisma.store.findUnique({ where: { managerId } });
    if (!store) throw new NotFoundException('You do not have a store profile.');

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        ...(dto.banner !== undefined && { banner: dto.banner }),
        ...(dto.address && { address: dto.address }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
      },
    });

    return { message: 'Store profile updated.', store: updated };
  }

  // ─── TOGGLE STORE OPEN / CLOSE ─────────────────────────────────────────
  async toggleStoreOpen(managerId: string, isOpen: boolean) {
    const store = await this.prisma.store.findUnique({ where: { managerId } });
    if (!store) throw new NotFoundException('You do not have a store profile.');

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: { isOpen },
    });

    return {
      message: isOpen ? 'Store is now open.' : 'Store is now closed.',
      store: updated,
    };
  }

  // ─── LIST STORE ORDERS (For Store Manager Dashboard) ────────────────────
  async getStoreOrders(
    managerId: string,
    status?: string,
    page = 1,
    limit = 20,
  ) {
    const store = await this.prisma.store.findUnique({ where: { managerId } });
    if (!store) throw new NotFoundException('You do not have a store profile.');

    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { storeId: store.id };
    if (status) where.status = status as OrderStatus;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: { product: true },
          },
          customer: {
            select: { id: true, name: true, phoneNumber: true },
          },
          picker: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { placedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data: orders, total, page, limit };
  }

  // ─── STORE MANAGER ANALYTICS & STATS ────────────────────────────────────
  async getStoreStats(
    user: Pick<User, 'id' | 'role'>,
    period: StatsPeriod = StatsPeriod.WEEK,
    storeId?: string,
  ) {
    let where: any = {};
    if (user.role === Role.ADMIN && storeId) {
      where = { id: storeId };
    } else {
      where = { managerId: user.id };
    }

    const store = await this.prisma.store.findUnique({ where });
    if (!store) throw new NotFoundException('Store profile not found.');

    const { current, previous } = this.getRange(period);

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getMetrics(store.id, current.start, current.end),
      this.getMetrics(store.id, previous.start, previous.end),
    ]);

    const chartData = await this.getChartData(
      store.id,
      current.start,
      current.end,
      period,
    );
    const topProducts = await this.getTopProducts(
      store.id,
      current.start,
      current.end,
    );
    const paymentBreakdown = await this.getPaymentBreakdown(
      store.id,
      current.start,
      current.end,
    );

    return {
      kpis: {
        revenue: {
          value: Math.round(currentMetrics.revenue * 100) / 100,
          change: this.calcChange(
            currentMetrics.revenue,
            previousMetrics.revenue,
          ),
        },
        orders: {
          value: currentMetrics.orders,
          change: this.calcChange(
            currentMetrics.orders,
            previousMetrics.orders,
          ),
        },
        aov: {
          value: Math.round(currentMetrics.aov * 100) / 100,
          change: this.calcChange(currentMetrics.aov, previousMetrics.aov),
        },
      },
      chartData,
      topProducts,
      paymentBreakdown,
    };
  }

  async getStoreDashboardStats(
    user: Pick<User, 'id' | 'role'>,
    startDate?: Date,
    endDate?: Date,
    storeId?: string,
  ) {
    let where: any = {};
    if (user.role === Role.ADMIN && storeId) {
      where = { id: storeId };
    } else {
      where = { managerId: user.id };
    }

    const store = await this.prisma.store.findUnique({ where });
    if (!store) throw new NotFoundException('Store profile not found.');

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();

    const [metrics, activeOrdersCount, cancelledOrdersCount] =
      await Promise.all([
        this.getMetrics(store.id, start, end),
        this.prisma.order.count({
          where: {
            storeId: store.id,
            status: { in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] },
          },
        }),
        this.prisma.order.count({
          where: {
            storeId: store.id,
            status: { in: ['CANCELLED', 'REFUSED'] },
            placedAt: { gte: start, lte: end },
          },
        }),
      ]);

    return {
      store: { id: store.id, name: store.name, isOpen: store.isOpen },
      totalOrders: metrics.orders,
      totalRevenue: Math.round(metrics.revenue * 100) / 100,
      activeOrders: activeOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      aov: Math.round(metrics.aov * 100) / 100,
    };
  }

  async getMyStoreSettlements(
    user: Pick<User, 'id' | 'role'>,
    page = 1,
    limit = 20,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { managerId: user.id },
    });

    if (!store) {
      throw new NotFoundException('Store profile not found.');
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where: { storeId: store.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlement.count({
        where: { storeId: store.id },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Stats Helper Methods ──
  private getRange(period: StatsPeriod) {
    const now = new Date();
    let cs: Date, ps: Date, pe: Date;

    if (period === StatsPeriod.TODAY) {
      cs = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      ps = new Date(cs.getTime() - 86400000);
      pe = new Date(cs.getTime() - 1);
    } else if (period === StatsPeriod.WEEK) {
      cs = new Date(now.getTime() - 7 * 86400000);
      ps = new Date(cs.getTime() - 7 * 86400000);
      pe = new Date(cs.getTime() - 1);
    } else if (period === StatsPeriod.MONTH) {
      cs = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      ps = new Date(cs.getFullYear(), cs.getMonth() - 1, cs.getDate());
      pe = new Date(cs.getTime() - 1);
    } else {
      cs = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      ps = new Date(cs.getFullYear() - 1, cs.getMonth(), cs.getDate());
      pe = new Date(cs.getTime() - 1);
    }

    return {
      current: { start: cs, end: now },
      previous: { start: ps, end: pe },
    };
  }

  private async getMetrics(storeId: string, start: Date, end: Date) {
    const stats = await this.prisma.order.aggregate({
      where: {
        storeId,
        status: 'DELIVERED',
        placedAt: { gte: start, lte: end },
      },
      _sum: { itemTotal: true },
      _count: { id: true },
    });
    const revenue = stats._sum.itemTotal || 0;
    const orders = stats._count.id || 0;
    return { revenue, orders, aov: orders > 0 ? revenue / orders : 0 };
  }

  private calcChange(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return parseFloat((((cur - prev) / prev) * 100).toFixed(1));
  }

  private async getChartData(
    storeId: string,
    start: Date,
    end: Date,
    period: StatsPeriod,
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: 'DELIVERED',
        placedAt: { gte: start, lte: end },
      },
      select: { placedAt: true, itemTotal: true },
    });

    const groups: Record<string, number> = {};
    orders.forEach((o) => {
      const d = new Date(o.placedAt);
      let key: string;
      if (period === StatsPeriod.TODAY) key = `${d.getHours()}:00`;
      else if (period === StatsPeriod.WEEK)
        key = d.toLocaleDateString('en-US', { weekday: 'short' });
      else if (period === StatsPeriod.MONTH)
        key = `Week ${Math.ceil(d.getDate() / 7)}`;
      else key = d.toLocaleDateString('en-US', { month: 'short' });
      groups[key] = (groups[key] || 0) + o.itemTotal;
    });

    return Object.entries(groups).map(([label, value]) => ({
      label,
      value: Math.round(value * 100) / 100,
    }));
  }

  private async getTopProducts(storeId: string, start: Date, end: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          storeId,
          status: 'DELIVERED',
          placedAt: { gte: start, lte: end },
        },
      },
      include: { product: true },
    });

    const counts: Record<
      string,
      { orders: number; revenue: number; name: string }
    > = {};
    items.forEach((item) => {
      if (!item.productId || !item.product) return;
      if (!counts[item.productId]) {
        counts[item.productId] = {
          orders: 0,
          revenue: 0,
          name: item.product.name,
        };
      }
      counts[item.productId].orders += item.quantity;
      counts[item.productId].revenue += item.totalPrice;
    });

    return Object.values(counts)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)
      .map((i) => ({ ...i, revenue: Math.round(i.revenue * 100) / 100 }));
  }

  private async getPaymentBreakdown(storeId: string, start: Date, end: Date) {
    const orders = await this.prisma.order.groupBy({
      by: ['paymentMode'],
      where: {
        storeId,
        status: 'DELIVERED',
        placedAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });
    const total = orders.reduce((s, o) => s + o._count.id, 0);
    return orders.map((o) => ({
      label: o.paymentMode,
      count: o._count.id,
      percentage: total > 0 ? Math.round((o._count.id / total) * 100) : 0,
    }));
  }
}
