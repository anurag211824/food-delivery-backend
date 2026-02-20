import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, MenuItem } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

const MenuItemExample = {
  id: 'clitem123',
  categoryId: 'clcat123',
  name: 'Butter Chicken',
  description: 'Creamy tomato based curry',
  price: 350,
  image: 'https://example.com/food.jpg',
  type: 'NON_VEG',
  isAvailable: true,
  isBestseller: true,
  spiceLevel: 'Medium',
  prepTime: 20,
  createdAt: '2026-02-20T12:00:00.000Z',
  updatedAt: '2026-02-20T12:00:00.000Z',
};

@ApiTags('Menu Management')
@Controller('api/menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) { }

  // ─── MANAGER: CREATE ──────────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Create a menu item',
    description: 'Add a new dish to your restaurant menu. Link it to a category via `categoryId`. Only the restaurant manager can create items.'
  })
  @ApiBody({ type: CreateMenuItemDto })
  @ApiResponse({
    status: 201,
    description: 'Menu item created successfully',
    schema: { example: MenuItemExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  create(@Body() dto: CreateMenuItemDto, @Req() req: AuthenticatedRequest): Promise<MenuItem> {
    return this.menuItemsService.create(dto, req.user.id);
  }

  // ─── PUBLIC: LIST ALL ─────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List all menu items',
    description: 'Returns all items across all restaurants. Mainly for admin/debug use.'
  })
  @ApiResponse({
    status: 200,
    description: 'List of all menu items',
    schema: { example: [MenuItemExample] }
  })
  findAll() {
    return this.menuItemsService.findAll();
  }

  // ─── PUBLIC: BY RESTAURANT ────────────────────────────────────────────────
  @Get('restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Get menu by restaurant',
    description: 'Returns all menu items for a specific restaurant. Used to build the full menu page.'
  })
  @ApiParam({ name: 'restaurantId', example: 'clxyz789', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'All items for the restaurant',
    schema: { example: [MenuItemExample] }
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async findByRestaurant(@Param('restaurantId') restaurantId: string): Promise<MenuItem[]> {
    return this.menuItemsService.findAllByRestaurant(restaurantId);
  }

  // ─── PUBLIC: GET ONE ──────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Get menu item details',
    description: 'Fetch the full details of a single menu item — used for item detail modals or cart summaries.'
  })
  @ApiParam({ name: 'id', example: 'clitem123', description: 'Menu item ID' })
  @ApiResponse({
    status: 200,
    description: 'Menu item details',
    schema: { example: MenuItemExample }
  })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  async findOne(@Param('id') id: string): Promise<MenuItem> {
    return this.menuItemsService.findOne(id);
  }

  // ─── MANAGER: UPDATE ──────────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Update a menu item',
    description: 'Edit any field of a menu item — price, availability, spice level, etc. All fields are optional.'
  })
  @ApiParam({ name: 'id', example: 'clitem123', description: 'Menu item ID to update' })
  @ApiBody({ type: UpdateMenuItemDto })
  @ApiResponse({
    status: 200,
    description: 'Menu item updated successfully',
    schema: { example: MenuItemExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  update(@Param('id') id: string, @Body() updateMenuItemDto: UpdateMenuItemDto) {
    return this.menuItemsService.update(+id, updateMenuItemDto);
  }

  // ─── MANAGER: DELETE ──────────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Delete a menu item',
    description: 'Permanently remove a dish from the menu.'
  })
  @ApiParam({ name: 'id', example: 'clitem123', description: 'Menu item ID to delete' })
  @ApiResponse({
    status: 200,
    description: 'Menu item deleted successfully',
    schema: { example: { message: 'Item deleted' } }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  remove(@Param('id') id: string) {
    return this.menuItemsService.remove(+id);
  }
}
