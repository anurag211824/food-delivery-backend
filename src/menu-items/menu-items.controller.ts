import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

const MenuItemExample = {
  id: 'clitem123',
  categoryId: 'clcat123',
  name: 'Butter Chicken',
  description: 'Creamy tomato based curry',
  image: 'https://example.com/food.jpg',
  type: 'NON_VEG',
  isAvailable: true,
  isBestseller: true,
  spiceLevel: 'Medium',
  prepTime: 20,
  createdAt: '2026-02-20T12:00:00.000Z',
  updatedAt: '2026-02-20T12:00:00.000Z',
  variants: [
    {
      id: 'clvar123',
      name: 'Regular',
      price: 350,
      salePrice: null,
      quantity: null,
      servingSize: 'Serves 2',
      isDefault: true,
      isAvailable: true,
    },
  ],
  addons: [
    {
      id: 'clgroup123',
      name: 'Extra Toppings',
      minSelect: 0,
      maxSelect: 3,
      options: [
        { id: 'clopt123', name: 'Extra Cheese', price: 50, isAvailable: true },
      ],
    },
  ],
};

@ApiTags('Menu Management')
@Controller('api/menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  // ─── MANAGER: CREATE ──────────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Create a menu item with variants & addons',
    description:
      'Add a new dish with pricing variants and optional addon groups. At least one variant (or legacy `price` field) is required for pricing.',
  })
  @ApiBody({ type: CreateMenuItemDto })
  @ApiResponse({
    status: 201,
    description: 'Menu item created with variants and addons',
    schema: { example: MenuItemExample },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires RESTAURANT_MANAGER role',
  })
  create(@Body() dto: CreateMenuItemDto, @Req() req: AuthenticatedRequest) {
    return this.menuItemsService.create(dto, req.user);
  }

  // ─── PUBLIC: LIST ALL ─────────────────────────────────────────────────────
  @UseInterceptors(CacheInterceptor)
  @Get()
  @ApiOperation({
    summary: 'List all menu items',
    description:
      'Returns all items across all restaurants with full variant & addon details. Mainly for admin/debug use.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all menu items with variants and addons',
    schema: { example: [MenuItemExample] },
  })
  findAll() {
    return this.menuItemsService.findAll();
  }

  // ─── PUBLIC: BY RESTAURANT ────────────────────────────────────────────────
  @UseInterceptors(CacheInterceptor)
  @Get('restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Get menu by restaurant',
    description:
      'Returns all menu items for a specific restaurant with variants and addons. Used to build the full menu page.',
  })
  @ApiParam({
    name: 'restaurantId',
    example: 'clxyz789',
    description: 'Restaurant ID',
  })
  @ApiResponse({
    status: 200,
    description: 'All items for the restaurant with variants & addons',
    schema: { example: [MenuItemExample] },
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async findByRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.menuItemsService.findAllByRestaurant(restaurantId);
  }

  // ─── PUBLIC: GET ONE ──────────────────────────────────────────────────────
  @UseInterceptors(CacheInterceptor)
  @Get(':id')
  @ApiOperation({
    summary: 'Get menu item details',
    description:
      'Fetch full details of a single menu item including all variants and addons — used for item detail modals.',
  })
  @ApiParam({ name: 'id', example: 'clitem123', description: 'Menu item ID' })
  @ApiResponse({
    status: 200,
    description: 'Menu item with variants and addons',
    schema: { example: MenuItemExample },
  })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  async findOne(@Param('id') id: string) {
    return this.menuItemsService.findOne(id);
  }

  // ─── MANAGER: UPDATE ──────────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Update a menu item with variants & addons',
    description:
      'Edit item fields, add/update/delete variants and addons. Include `id` in variant/addon objects to update existing; omit to create new. Use `deleteVariantIds`/`deleteAddonGroupIds`/`deleteAddonOptionIds` for explicit deletion.',
  })
  @ApiParam({
    name: 'id',
    example: 'clitem123',
    description: 'Menu item ID to update',
  })
  @ApiBody({ type: UpdateMenuItemDto })
  @ApiResponse({
    status: 200,
    description: 'Menu item updated with variants and addons',
    schema: { example: MenuItemExample },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires RESTAURANT_MANAGER role',
  })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.menuItemsService.update(id, dto, req.user);
  }

  // ─── MANAGER: DELETE ──────────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Delete a menu item',
    description:
      'Permanently remove a dish and all its variants/addons from the menu.',
  })
  @ApiParam({
    name: 'id',
    example: 'clitem123',
    description: 'Menu item ID to delete',
  })
  @ApiResponse({
    status: 200,
    description: 'Menu item deleted successfully',
    schema: { example: { message: 'Item deleted' } },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires RESTAURANT_MANAGER role',
  })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.menuItemsService.remove(id, req.user);
  }
}
