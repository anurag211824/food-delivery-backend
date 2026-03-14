import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restaurant, VegType } from '@prisma/client';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { PaginationDto } from 'src/common/pagination.dto';

@Injectable()
export class RestaurantsService {
  constructor(private prisma: PrismaService) { }

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

    // 1. Fetch matching menu items with their category and restaurant
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

    // 2. Filter by distance if user coordinates are provided (7km radius)
    let filteredItems = items;
    if (userLat && userLng) {
      filteredItems = items.filter(item => {
        const distance = this.calculateDistance(userLat, userLng, item.category.restaurant.lat, item.category.restaurant.lng);
        return distance <= 7;
      });
    }

    // 3. Group by unique dish name (case-insensitive)
    const dishGroups = new Map<string, any[]>();
    for (const item of filteredItems) {
      const normalizedName = item.name.trim(); // We use raw name for grouping but case-insensitive map keys
      const key = normalizedName.toLowerCase();
      let group = dishGroups.get(key);
      if (!group) {
        group = [];
        dishGroups.set(key, group);
      }
      group.push(item);
    }

    // 4. Format and Aggregate Results
    const allDishes = Array.from(dishGroups.values()).map(group => {
      // Use the first item as a representative for dishDetails
      const repItem = group[0];
      if (!repItem) return null;
      const restaurants = group.map(item => {
        const restaurant = item.category.restaurant;
        let deliveryTime = "30-35 mins"; // Placeholder default
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

    // 5. Sorting for Dishes
    const effectiveSortBy = sortBy || 'rating';
    const effectiveSortOrder = sortOrder || 'desc';

    if (effectiveSortBy === 'rating') {
      allDishes.sort((a, b) => {
        const ratingA = a.restaurants.reduce((sum, r) => sum + r.rating, 0) / a.restaurants.length;
        const ratingB = b.restaurants.reduce((sum, r) => sum + r.rating, 0) / b.restaurants.length;
        return effectiveSortOrder === 'asc' ? ratingA - ratingB : ratingB - ratingA;
      });
    } else if (effectiveSortBy === 'costForTwo' || effectiveSortBy === 'deliveryTime') {
      // For these, we might want to sort by the minimum value in the restaurant list
      allDishes.sort((a, b) => {
        let valA, valB;
        if (effectiveSortBy === 'costForTwo') {
          valA = Math.min(...a.restaurants.map(r => r.costForTwo));
          valB = Math.min(...b.restaurants.map(r => r.costForTwo));
        } else {
          // Parse delivery time for sorting
          valA = parseInt(a.restaurants[0].estimatedDelivery);
          valB = parseInt(b.restaurants[0].estimatedDelivery);
        }
        return effectiveSortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    // 6. Pagination
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
      return await this.prisma.restaurant.update({
        where: { id },
        data: dto
      });
    } catch (error) {
      throw new NotFoundException(`Restaurant ${id} not found`);
    }
  }

  async remove(id: string) {
    return this.prisma.restaurant.update({
      where: { id },
      data: { isActive: false } // Soft delete as per your safety plan 
    });
  }

  // 4. MANAGER DASHBOARD
  async getDashboardStats(managerId: string, startDate?: Date, endDate?: Date) {
    // Determine the restaurant belonging to this manager
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { managerId }
    });

    if (!restaurant) {
      throw new NotFoundException('You do not have a restaurant associated with your account.');
    }

    // Default to today if no dates provided
    let start = startDate;
    let end = endDate;

    if (!start || !end) {
      const today = new Date();
      start = start || new Date(today.setHours(0, 0, 0, 0));
      end = end || new Date(today.setHours(23, 59, 59, 999));
    }

    const startFilter = start.toISOString();
    const endFilter = end.toISOString();

    // Fetch orders within the date range
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        placedAt: {
          gte: startFilter,
          lte: endFilter
        }
      },
      select: {
        status: true,
        itemTotal: true,
      }
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'DELIVERED');
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
    const activeOrders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');

    // Revenue calculation (summing itemTotal of delivered orders)
    const revenue = completedOrders.reduce((sum, order) => sum + order.itemTotal, 0);

    return {
      restaurantName: restaurant.name,
      period: {
        start: startFilter,
        end: endFilter
      },
      metrics: {
        totalOrders,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        activeOrders: activeOrders.length,
        revenue
      }
    };
  }
}