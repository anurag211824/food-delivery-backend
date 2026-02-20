import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { MenuCategoriesService } from './menu-categories.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Role, MenuCategory } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.types";

const CategoryExample = {
  id: 'clcat123',
  name: 'Main Course',
  restaurantId: 'clxyz789',
  type: null,
  createdAt: '2026-02-20T12:00:00.000Z',
  updatedAt: '2026-02-20T12:00:00.000Z',
  items: [],
};

@ApiTags('Menu Management')
@Controller('api/menu-categories')
export class MenuCategoriesController {
  constructor(private readonly menuCategoriesService: MenuCategoriesService) { }

  // ─── MANAGER: CREATE ──────────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Create a menu category',
    description: 'Add a new category (e.g., "Starters", "Main Course", "Drinks") to your restaurant menu. The restaurant is inferred from the logged-in manager.'
  })
  @ApiBody({ type: CreateMenuCategoryDto })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    schema: { example: CategoryExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  @ApiResponse({ status: 404, description: 'You do not have a restaurant yet' })
  async create(
    @Body() dto: CreateMenuCategoryDto,
    @Req() req: AuthenticatedRequest
  ): Promise<MenuCategory> {
    return this.menuCategoriesService.create(dto, req.user.id);
  }

  // ─── PUBLIC: BY RESTAURANT ────────────────────────────────────────────────
  @Get('restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Get categories by restaurant',
    description: 'Fetch all menu categories (with their items) for a specific restaurant. Used to build the menu page.'
  })
  @ApiParam({ name: 'restaurantId', example: 'clxyz789', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'List of categories with items',
    schema: { example: [CategoryExample] }
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async findByRestaurant(@Param('restaurantId') restaurantId: string): Promise<MenuCategory[]> {
    return this.menuCategoriesService.findAllByRestaurant(restaurantId);
  }

  // ─── PUBLIC: LIST ALL ─────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List all categories',
    description: 'Get all menu categories across all restaurants (admin/debug view).'
  })
  @ApiResponse({
    status: 200,
    description: 'List of all categories',
    schema: { example: [CategoryExample] }
  })
  async findAll(): Promise<MenuCategory[]> {
    return this.menuCategoriesService.findAll();
  }

  // ─── PUBLIC: GET ONE ──────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single category',
    description: 'Fetch one category with all of its menu items included.'
  })
  @ApiParam({ name: 'id', example: 'clcat123', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category with its items',
    schema: { example: CategoryExample }
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string): Promise<MenuCategory> {
    return this.menuCategoriesService.findOne(id);
  }

  // ─── MANAGER: UPDATE ──────────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Update a category',
    description: 'Rename or modify a menu category.'
  })
  @ApiParam({ name: 'id', example: 'clcat123', description: 'Category ID to update' })
  @ApiBody({ type: UpdateMenuCategoryDto })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    schema: { example: CategoryExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateMenuCategoryDto): Promise<MenuCategory> {
    return this.menuCategoriesService.update(id, updateDto);
  }

  // ─── MANAGER: DELETE ──────────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Delete a category',
    description: 'Remove a category and all its associated menu items permanently.'
  })
  @ApiParam({ name: 'id', example: 'clcat123', description: 'Category ID to delete' })
  @ApiResponse({
    status: 200,
    description: 'Category deleted successfully',
    schema: { example: { ...CategoryExample, items: undefined } }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id') id: string): Promise<MenuCategory> {
    return this.menuCategoriesService.remove(id);
  }
}