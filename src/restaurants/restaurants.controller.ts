import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role, Restaurant } from '@prisma/client';
import type { AuthenticatedRequest } from 'src/auth/auth.types';

@ApiTags('Discover & Order')
@Controller('api/restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) { }

  // 1. PUBLIC SEARCH ENGINE
@Get('search')
  @ApiOperation({ 
    summary: 'Search Engine', 
    description: 'Search by restaurant name, dish name, or popular items. Supports filters for Veg/Non-Veg and Rating.' 
  })
  async search(@Query() dto: SearchRestaurantsDto) {
    return this.restaurantsService.search(dto);
  }

  // 2. PUBLIC LISTINGS
  @Get()
  @ApiOperation({ summary: 'List all restaurants', description: 'Displays cards with name, rating, and distance' })
  async findAll() {
    return this.restaurantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant details', description: 'Shows header info and full category-wise menu' })
  async findOne(@Param('id') id: string) {
    return this.restaurantsService.findOne(id);
  }

  // 3. SECURE MANAGEMENT (For Restaurant Partners)
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Register restaurant', description: 'Manager account and profile setup' }) 
  async create(
    @Body() dto: CreateRestaurantDto,
    @Req() req: AuthenticatedRequest
  ): Promise<Restaurant> {
    const managerId = req.user.id;
    return this.restaurantsService.create(dto, managerId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update profile', description: 'Edit logo, timing, or contact info' }) 
  async update(@Param('id') id: string, @Body() updateDto: UpdateRestaurantDto) {
    return this.restaurantsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Usually only Admins can delete a whole restaurant
  @ApiOperation({ summary: 'Delete restaurant record' })
  async remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }
}