import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { MenuCategoriesService } from './menu-categories.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Role, MenuCategory } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.types";

@Controller('api/menu-categories')
export class MenuCategoriesController {
  constructor(private readonly menuCategoriesService: MenuCategoriesService) { }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  async create(
    @Body() dto: CreateMenuCategoryDto,
    @Req() req: AuthenticatedRequest
  ): Promise<MenuCategory> {
    return this.menuCategoriesService.create(dto, req.user.id);
  }

  // Get all categories for a specific restaurant
  @Get('restaurant/:restaurantId')
  async findByRestaurant(@Param('restaurantId') restaurantId: string): Promise<MenuCategory[]> {
    return this.menuCategoriesService.findAllByRestaurant(restaurantId);
  }

  // Get all categories in the system (Admin use)
  @Get()
  async findAll(): Promise<MenuCategory[]> {
    return this.menuCategoriesService.findAll();
  }

  // Get a single category by its specific ID
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MenuCategory> {
    return this.menuCategoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  async update(@Param('id') id: string, @Body() updateDto: UpdateMenuCategoryDto): Promise<MenuCategory> {
    return this.menuCategoriesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  async remove(@Param('id') id: string): Promise<MenuCategory> {
    return this.menuCategoriesService.remove(id);
  }
}