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

  // 1. PUBLIC SEARCH LOGIC
  async search(dto: SearchRestaurantsDto) {
    const { query, type, minRating, sortBy, sortOrder, userLat, userLng, page, limit } = dto;

    const pageNumber = page || 1;
    const limitNumber = limit || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const restaurants = await this.prisma.restaurant.findMany({
      skip: skip,
      take: limitNumber,
      where: {
        isActive: true, // Only show active restaurants 
        AND: [
          // 1. Keyword Search: Name, Description, or Dish Name 
          query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { menuCategories: { some: { items: { some: { name: { contains: query, mode: 'insensitive' } } } } } }
            ]
          } : {},
          // 2. Veg/Non-Veg Filter
          type ? {
            menuCategories: {
              some: { items: { some: { type: type as VegType } } }
            }
          } : {},
          // 3. Min Rating Filter 
          minRating ? {
            rating: { gte: Number(minRating) }
          } : {},
        ]
      },
      // 4. Prisma-level Sorting (for DB columns)
      orderBy: sortBy && ['rating', 'costForTwo'].includes(sortBy)
        ? { [sortBy]: sortOrder || 'desc' }
        : undefined,

      include: {
        menuCategories: {
          include: {
            items: {
              where: {
                isAvailable: true,
                ...(type ? { type: type as VegType } : {}),
                // Filter items to match the query if provided
                ...(query ? { name: { contains: query, mode: 'insensitive' } } : {})
              }
            }
          }
        }
      }
    });

    // Determine default sort if not explicitly requested
    const effectiveSortBy = sortBy || 'rating';
    const effectiveSortOrder = sortOrder || 'desc';

    // Post-process the results and apply a 7km hard radius
    const processedRestaurants: any[] = [];

    for (const restaurant of restaurants) {
      let calculatedDeliveryTime = 30; // Default 30 mins

      if (userLat && userLng) {
        const distanceKm = this.calculateDistance(userLat, userLng, restaurant.lat, restaurant.lng);

        // 🚨 Hard Limit: Skip this restaurant if it is more than 7km away
        if (distanceKm > 7) {
          continue;
        }

        calculatedDeliveryTime = Math.round(15 + (distanceKm * 5)); // Base 15 mins + 5 mins per km
      }

      // Filter out empty categories (where no items matched the search)
      const filteredCategories = restaurant.menuCategories
        .filter(category => category.items.length > 0);

      processedRestaurants.push({
        ...restaurant,
        deliveryTimeEst: calculatedDeliveryTime,
        menuCategories: filteredCategories
      });
    }

    // In-memory sorting for delivery time (requires calculated distance)
    if (effectiveSortBy === 'deliveryTime') {
      processedRestaurants.sort((a, b) => {
        const valA = a.deliveryTimeEst;
        const valB = b.deliveryTimeEst;
        return effectiveSortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    // --- PAGINATION METADATA ---
    // Make a count query using the exact same filters to get the total number of matches
    const totalCount = await this.prisma.restaurant.count({
      where: {
        isActive: true,
        AND: [
          query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { menuCategories: { some: { items: { some: { name: { contains: query, mode: 'insensitive' } } } } } }
            ]
          } : {},
          type ? {
            menuCategories: {
              some: { items: { some: { type: type as VegType } } }
            }
          } : {},
          minRating ? {
            rating: { gte: Number(minRating) }
          } : {},
        ]
      }
    });

    return {
      data: processedRestaurants,
      meta: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
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
          costForTwo: true,
          cuisineTypes: true,
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