import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, MenuItem } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@ApiTags('Menu Management')
@Controller('api/menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) { }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Create menu item',
    description: 'Add a new food item to your restaurant menu with pricing, images, and dietary info'
  })
  @ApiResponse({ status: 201, description: 'Menu item created successfully' })
  @ApiResponse({ status: 403, description: 'Only restaurant managers can create items' })
  create(@Body() dto: CreateMenuItemDto, @Req() req: AuthenticatedRequest): Promise<MenuItem> {
    return this.menuItemsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List all menu items',
    description: 'Get all menu items across all restaurants (admin view)'
  })
  @ApiResponse({ status: 200, description: 'List of all menu items' })
  findAll() {
    return this.menuItemsService.findAll();
  }

  @Get('restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Get menu by restaurant',
    description: 'Fetch all menu items for a specific restaurant'
  })
  @ApiResponse({ status: 200, description: 'List of menu items for the restaurant' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async findByRestaurant(@Param('restaurantId') restaurantId: string): Promise<MenuItem[]> {
    return this.menuItemsService.findAllByRestaurant(restaurantId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get menu item details',
    description: 'Fetch detailed information about a specific menu item'
  })
  @ApiResponse({ status: 200, description: 'Menu item details' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  async findOne(@Param('id') id: string): Promise<MenuItem> {
    return this.menuItemsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Update menu item',
    description: 'Edit price, availability, or other item details'
  })
  @ApiResponse({ status: 200, description: 'Menu item updated successfully' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  update(@Param('id') id: string, @Body() updateMenuItemDto: UpdateMenuItemDto) {
    return this.menuItemsService.update(+id, updateMenuItemDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  @ApiOperation({
    summary: 'Delete menu item',
    description: 'Remove an item from the menu'
  })
  @ApiResponse({ status: 200, description: 'Menu item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  remove(@Param('id') id: string) {
    return this.menuItemsService.remove(+id);
  }
}
