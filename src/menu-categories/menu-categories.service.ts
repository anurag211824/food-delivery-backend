import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MenuCategory } from '@prisma/client';

@Injectable()
export class MenuCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMenuCategoryDto, managerId: string): Promise<MenuCategory> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { managerId }
    });

    if (!restaurant) {
      throw new NotFoundException("You do not have a restaurant yet.");
    }

    return this.prisma.menuCategory.create({
      data: {
        name: dto.name,
        restaurantId: restaurant.id
      }
    });
  }

  async findAllByRestaurant(restaurantId: string): Promise<MenuCategory[]> {
    return this.prisma.menuCategory.findMany({
      where: { restaurantId },
      include: { items: true }
    });
  }

  async findAll(): Promise<MenuCategory[]> {
    return this.prisma.menuCategory.findMany({
      include: { items: true }
    });
  }

  async findOne(id: string): Promise<MenuCategory> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
      include: { items: true }
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