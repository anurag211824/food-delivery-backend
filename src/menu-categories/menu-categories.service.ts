import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MenuCategory } from '@prisma/client';

/** Deep include for items → variants → addons → options */
const CATEGORY_ITEMS_INCLUDE = {
  items: {
    include: {
      variants: {
        orderBy: { isDefault: 'desc' as const },
      },
      addons: {
        include: {
          options: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class MenuCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMenuCategoryDto, user: { id: string, role: string }): Promise<MenuCategory> {
    let restaurantId = dto.restaurantId;

    if (!restaurantId) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { managerId: user.id }
      });

      if (!restaurant) {
        throw new NotFoundException("You do not have a restaurant yet.");
      }
      restaurantId = restaurant.id;
    } else if (user.role !== 'ADMIN') {
      // If a non-admin tries to specify an ID, verify they own it
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId }
      });
      if (!restaurant || restaurant.managerId !== user.id) {
        throw new NotFoundException("Restaurant not found or permission denied.");
      }
    }

    return this.prisma.menuCategory.create({
      data: {
        name: dto.name,
        image: dto.image,
        type: dto.type,
        restaurantId: restaurantId
      }
    });
  }

  async findAllByRestaurant(restaurantId: string): Promise<MenuCategory[]> {
    return this.prisma.menuCategory.findMany({
      where: { restaurantId },
      include: CATEGORY_ITEMS_INCLUDE,
    });
  }

  async findAll(): Promise<MenuCategory[]> {
    return this.prisma.menuCategory.findMany({
      include: CATEGORY_ITEMS_INCLUDE,
    });
  }

  async findOne(id: string): Promise<MenuCategory> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
      include: CATEGORY_ITEMS_INCLUDE,
    });

    if (!category) {
      throw new NotFoundException(`Menu Category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: string, dto: UpdateMenuCategoryDto): Promise<MenuCategory> {
    try {
      return await this.prisma.menuCategory.update({
        where: { id },
        data: dto
      });
    } catch (error) {
      throw new NotFoundException(`Failed to update: Category ${id} not found`);
    }
  }

  async remove(id: string): Promise<MenuCategory> {
    try {
      return await this.prisma.menuCategory.delete({
        where: { id }
      });
    } catch (error) {
      throw new NotFoundException(`Failed to delete: Category ${id} not found`);
    }
  }
}