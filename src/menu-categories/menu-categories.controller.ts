import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MenuCategoriesService } from './menu-categories.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Role, MenuCategory } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.types";

@ApiTags('Menu Management')
@Controller('api/menu-categories')
export class MenuCategoriesController {
  constructor(private readonly menuCategoriesService: MenuCategoriesService) { }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Create menu category',
    description: 'Add a new category (e.g., "Starters", "Main Course") to organize your menu items'
  })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 403, description: 'Only restaurant managers can create categories' })
  async create(
    @Body() dto: CreateMenuCategoryDto,
    @Req() req: AuthenticatedRequest
  ): Promise<MenuCategory> {
    return this.menuCategoriesService.create(dto, req.user.id);
  }

  @Get('restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Get categories by restaurant',
    description: 'Fetch all menu categories for a specific restaurant (for menu organization)'
  })
  @ApiResponse({ status: 200, description: 'List of categories with their items' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async findByRestaurant(@Param('restaurantId') restaurantId: string): Promise<MenuCategory[]> {
    return this.menuCategoriesService.findAllByRestaurant(restaurantId);
  }

  @Get()
  @ApiOperation({
    summary: 'List all categories',
    description: 'Get all menu categories across all restaurants (admin view)'
  })
  @ApiResponse({ status: 200, description: 'List of all categories' })
  async findAll(): Promise<MenuCategory[]> {
    return this.menuCategoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get category details',
    description: 'Fetch a single category with its menu items'
  })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string): Promise<MenuCategory> {
    return this.menuCategoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Update category',
    description: 'Rename or modify a category'
  })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateMenuCategoryDto): Promise<MenuCategory> {
    return this.menuCategoriesService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Delete category',
    description: 'Remove a category and all its items'
  })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id') id: string): Promise<MenuCategory> {
    return this.menuCategoriesService.remove(id);
  }
}