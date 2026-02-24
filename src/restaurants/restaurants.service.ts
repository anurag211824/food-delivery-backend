import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restaurant, VegType } from '@prisma/client';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';

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

  // 1. PUBLIC SEARCH LOGIC
  async search(dto: SearchRestaurantsDto) {
    const { query, type, minRating } = dto;

    return this.prisma.restaurant.findMany({
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
      include: {
        menuCategories: {
          include: {
            items: {
              where: {
                isAvailable: true,
                ...(type ? { type: type as VegType } : {})
              }
            }
          }
        }
      }
    });
  }

  // 2. LISTINGS & DETAILS
  async findAll() {
    return await this.prisma.restaurant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        image: true,
        costForTwo: true,
        cuisineTypes: true,
      }
    });
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
}