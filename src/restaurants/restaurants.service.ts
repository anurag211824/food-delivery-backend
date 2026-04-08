import { ConflictException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restaurant, VegType } from '@prisma/client';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { GetStatsDto, StatsPeriod } from './dto/get-stats.dto';
import { PaginationDto } from 'src/common/pagination.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RestaurantsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) { }

  async create(createRestaurantDto: CreateRestaurantDto, managerId: string): Promise<Restaurant> {
    const existing = await this.prisma.restaurant.findUnique({
      where: { managerId }
    });

    if (existing) {
      throw new ConflictException("You already have a restaurant");
    }

    return this.prisma.restaurant.create({
      data: {
        ...createRestaurantDto,
        managerId,
        isActive: true,
        isOpen: true,
        isVerified: false,
      }
    });
  }

  // Helper function to calculate distance in km between two coordinates
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

  // 1. PUBLIC SEARCH LOGIC (Grouped by Dishes)
  async search(dto: SearchRestaurantsDto) {
    const { query, type, minRating, sortBy, sortOrder, userLat, userLng, page, limit } = dto;

    const pageNumber = page || 1;
    const limitNumber = limit || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const items = await this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        category: {
          restaurant: {
            isActive: true,
            ...(minRating ? { rating: { gte: Number(minRating) } } : {}),
          },
        },
        AND: [
          query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { category: { name: { contains: query, mode: 'insensitive' } } },
              { category: { restaurant: { name: { contains: query, mode: 'insensitive' } } } },
            ]
          } : {},
          type ? { type: type as VegType } : {},
        ]
      },
      include: {
        category: {
          include: {
            restaurant: true,
          }
        }
      }
    });

    let filteredItems = items;
    if (userLat && userLng) {
      filteredItems = items.filter(item => {
        const distance = this.calculateDistance(userLat, userLng, item.category.restaurant.lat, item.category.restaurant.lng);
        return distance <= 7;
      });
    }

    const dishGroups = new Map<string, any[]>();
    for (const item of filteredItems) {
      const normalizedName = item.name.trim();
      const key = normalizedName.toLowerCase();
      let group = dishGroups.get(key);
      if (!group) {
        group = [];
        dishGroups.set(key, group);
      }
      group.push(item);
    }

    const allDishes = Array.from(dishGroups.values()).map(group => {
      const repItem = group[0];
      if (!repItem) return null;
      const restaurants = group.map(item => {
        const restaurant = item.category.restaurant;
        let deliveryTime = "30-35 mins";
        if (userLat && userLng) {
          const dist = this.calculateDistance(userLat, userLng, restaurant.lat, restaurant.lng);
          deliveryTime = `${Math.round(15 + (dist * 5))}-${Math.round(20 + (dist * 5))} mins`;
        }

        return {
          restaurantId: restaurant.id,
          name: restaurant.name,
          logo: restaurant.logo,
          rating: restaurant.rating,
          ratingCount: restaurant.ratingCount,
          costForTwo: restaurant.costForTwo,
          menuItemId: item.id,
          price: item.price,
          isBestseller: item.isBestseller,
          estimatedDelivery: deliveryTime
        };
      });

      const avgPrice = group.reduce((sum, item) => sum + item.price, 0) / group.length;
      const popularChoice = group.some(item => item.isBestseller);

      return {
        dishId: `dish_${repItem.name.toLowerCase().replace(/\s+/g, '_')}`,
        dishName: repItem.name,
        categoryName: repItem.category.name,
        dishDetails: {
          description: repItem.description,
          image: repItem.image,
          type: repItem.type,
          spiceLevel: repItem.spiceLevel,
          prepTime: repItem.prepTime,
          isAvailable: repItem.isAvailable,
          avgPrice: parseFloat(avgPrice.toFixed(2)),
          popularChoice: popularChoice
        },
        restaurants: restaurants
      };
    }).filter((dish): dish is NonNullable<typeof dish> => dish !== null);

    const effectiveSortBy = sortBy || 'rating';
    const effectiveSortOrder = sortOrder || 'desc';

    if (effectiveSortBy === 'rating') {
      allDishes.sort((a, b) => {
        const ratingA = a.restaurants.reduce((sum, r) => sum + r.rating, 0) / a.restaurants.length;
        const ratingB = b.restaurants.reduce((sum, r) => sum + r.rating, 0) / b.restaurants.length;
        return effectiveSortOrder === 'asc' ? ratingA - ratingB : ratingB - ratingA;
      });
    } else if (effectiveSortBy === 'costForTwo' || effectiveSortBy === 'deliveryTime') {
      allDishes.sort((a, b) => {
        let valA, valB;
        if (effectiveSortBy === 'costForTwo') {
          valA = Math.min(...a.restaurants.map(r => r.costForTwo));
          valB = Math.min(...b.restaurants.map(r => r.costForTwo));
        } else {
          valA = parseInt(a.restaurants[0].estimatedDelivery);
          valB = parseInt(b.restaurants[0].estimatedDelivery);
        }
        return effectiveSortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    const totalUniqueDishes = allDishes.length;
    const paginatedDishes = allDishes.slice(skip, skip + limitNumber);

    return {
      searchTerm: query || "",
      totalUniqueDishes,
      results: paginatedDishes,
      meta: {
        total: totalUniqueDishes,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalUniqueDishes / limitNumber),
      }
    };
  }

  // 2. LISTINGS & DETAILS
  async findMyRestaurant(managerId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { managerId },
      include: {
        menuCategories: {
          include: {
            items: true
          }
        },
        reviews: true
      }
    });

    if (!restaurant) {
      throw new NotFoundException('You do not possess a registered restaurant profile.');
    }
    return restaurant;
  }

  async findAll(dto: PaginationDto) {
    const pageNumber = dto.page || 1;
    const limitNumber = dto.limit || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const [data, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        skip,
        take: limitNumber,
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          image: true,
          type: true,
          costForTwo: true,
          cuisineTypes: true,
          rating: true,
          ratingCount: true,
        }
      }),
      this.prisma.restaurant.count({
        where: { isActive: true }
      })
    ]);

    return {
      data,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      }
    };
  }

  async findOne(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        menuCategories: {
          include: {
            items: true
          }
        },
        reviews: true
      }
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${id} not found`);
    }
    return restaurant;
  }

  // 3. MANAGEMENT TOOLS
  async update(id: string, dto: UpdateRestaurantDto) {
    try {
      const updated = await this.prisma.restaurant.update({
        where: { id },
        data: dto
      });
      await this.cacheManager.clear();
      return updated;
    } catch (error) {
      throw new NotFoundException(`Restaurant ${id} not found`);
    }
  }

  async remove(id: string) {
    const deleted = await this.prisma.restaurant.update({
      where: { id },
      data: { isActive: false }
    });
    await this.cacheManager.clear();
    return deleted;
  }

  // 4. MANAGER DASHBOARD (legacy)
  async getDashboardStats(managerId: string, startDate?: Date, endDate?: Date) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { managerId }
    });

    if (!restaurant) {
      throw new NotFoundException('You do not have a restaurant associated with your account.');
    }

    let start = startDate;
    let end = endDate;

    if (!start || !end) {
      const today = new Date();
      start = start || new Date(today.setHours(0, 0, 0, 0));
      end = end || new Date(today.setHours(23, 59, 59, 999));
    }

    const startFilter = start.toISOString();
    const endFilter = end.toISOString();

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        placedAt: { gte: startFilter, lte: endFilter }
      },
      select: { status: true, itemTotal: true }
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'DELIVERED');
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
    const activeOrders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
    const revenue = completedOrders.reduce((sum, order) => sum + order.itemTotal, 0);

    return {
      restaurantName: restaurant.name,
      period: { start: startFilter, end: endFilter },
      metrics: {
        totalOrders,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        activeOrders: activeOrders.length,
        revenue
      }
    };
  }

  // ─── 5. STATS PAGE API ──────────────────────────────────────────────────────
  async getStats(managerId: string, period: StatsPeriod = StatsPeriod.WEEK) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { managerId }
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const { current, previous } = this.getRange(period);

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getMetrics(restaurant.id, current.start, current.end),
      this.getMetrics(restaurant.id, previous.start, previous.end)
    ]);

    const chartData = await this.getChartData(restaurant.id, current.start, current.end, period);
    const topItems = await this.getTopItems(restaurant.id, current.start, current.end);
    const paymentBreakdown = await this.getPaymentBreakdown(restaurant.id, current.start, current.end);
    const ratings = await this.getRatingSummary(restaurant.id);

    return {
      kpis: {
        revenue: {
          value: Math.round(currentMetrics.revenue * 100) / 100,
          change: this.calcChange(currentMetrics.revenue, previousMetrics.revenue)
        },
        orders: {
          value: currentMetrics.orders,
          change: this.calcChange(currentMetrics.orders, previousMetrics.orders)
        },
        aov: {
          value: Math.round(currentMetrics.aov * 100) / 100,
          change: this.calcChange(currentMetrics.aov, previousMetrics.aov)
        }
      },
      chartData,
      topItems,
      paymentBreakdown,
      ratings
    };
  }

  // ── Helpers ──
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

    return { current: { start: cs, end: now }, previous: { start: ps, end: pe } };
  }

  private async getMetrics(restaurantId: string, start: Date, end: Date) {
    const stats = await this.prisma.order.aggregate({
      where: {
        restaurantId,
        status: 'DELIVERED',
        placedAt: { gte: start, lte: end }
      },
      _sum: { itemTotal: true },
      _count: { id: true }
    });
    const revenue = stats._sum.itemTotal || 0;
    const orders = stats._count.id || 0;
    return { revenue, orders, aov: orders > 0 ? revenue / orders : 0 };
  }

  private calcChange(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return parseFloat(((cur - prev) / prev * 100).toFixed(1));
  }

  private async getChartData(restaurantId: string, start: Date, end: Date, period: StatsPeriod) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId, status: 'DELIVERED',
        placedAt: { gte: start, lte: end }
      },
      select: { placedAt: true, itemTotal: true }
    });

    const groups: Record<string, number> = {};
    orders.forEach(o => {
      const d = new Date(o.placedAt);
      let key: string;
      if (period === StatsPeriod.TODAY) key = `${d.getHours()}:00`;
      else if (period === StatsPeriod.WEEK) key = d.toLocaleDateString('en-US', { weekday: 'short' });
      else if (period === StatsPeriod.MONTH) key = `Week ${Math.ceil(d.getDate() / 7)}`;
      else key = d.toLocaleDateString('en-US', { month: 'short' });
      groups[key] = (groups[key] || 0) + o.itemTotal;
    });

    return Object.entries(groups).map(([label, value]) => ({
      label, value: Math.round(value * 100) / 100
    }));
  }

  private async getTopItems(restaurantId: string, start: Date, end: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { restaurantId, status: 'DELIVERED', placedAt: { gte: start, lte: end } }
      },
      include: { menuItem: true }
    });

    const counts: Record<string, { orders: number; revenue: number; name: string }> = {};
    items.forEach(item => {
      if (!counts[item.menuItemId]) {
        counts[item.menuItemId] = { orders: 0, revenue: 0, name: item.menuItem.name };
      }
      counts[item.menuItemId].orders += item.quantity;
      counts[item.menuItemId].revenue += item.price * item.quantity;
    });

    return Object.values(counts)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)
      .map(i => ({ ...i, revenue: Math.round(i.revenue * 100) / 100 }));
  }

  private async getPaymentBreakdown(restaurantId: string, start: Date, end: Date) {
    const orders = await this.prisma.order.groupBy({
      by: ['paymentMode'],
      where: {
        restaurantId, status: 'DELIVERED',
        placedAt: { gte: start, lte: end }
      },
      _count: { id: true }
    });
    const total = orders.reduce((s, o) => s + o._count.id, 0);
    return orders.map(o => ({
      label: o.paymentMode,
      count: o._count.id,
      percentage: total > 0 ? Math.round((o._count.id / total) * 100) : 0
    }));
  }

  private async getRatingSummary(restaurantId: string) {
    const reviews = await this.prisma.review.findMany({ where: { restaurantId } });
    const total = reviews.length;
    if (total === 0) return { average: 0, count: 0, breakdown: [] };

    const sum = reviews.reduce((s, r) => s + r.foodRating, 0);
    const average = parseFloat((sum / total).toFixed(1));
    const breakdown = [5, 4, 3, 2, 1].map(stars => ({
      stars,
      percentage: Math.round((reviews.filter(r => r.foodRating === stars).length / total) * 100)
    }));

    return { average, count: total, breakdown };
  }
}