import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, MenuItem } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Controller('api/menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Post()
  @UseGuards(AuthGuard,RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER)
  create(@Body() dto: CreateMenuItemDto, @Req() req: AuthenticatedRequest): Promise<MenuItem> {
    return this.menuItemsService.create(dto,req.user.id)
  }

  @Get()
  findAll() {
    return this.menuItemsService.findAll();
  }

  @Get('restaurant/:restaurantId')
  async findByRestaurant(@Param('restaurantId') restaurantId: string): Promise<MenuItem[]> {
    return this.menuItemsService.findAllByRestaurant(restaurantId);
  }

@Get(':id')
  async findOne(@Param('id') id: string): Promise<MenuItem> {
    return this.menuItemsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMenuItemDto: UpdateMenuItemDto) {
    return this.menuItemsService.update(+id, updateMenuItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menuItemsService.remove(+id);
  }
}
