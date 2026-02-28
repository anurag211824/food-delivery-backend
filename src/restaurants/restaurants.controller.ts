import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { PaginationDto } from '../common/pagination.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role, Restaurant } from '@prisma/client';
import type { AuthenticatedRequest } from 'src/auth/auth.types';

const RestaurantExample = {
  id: 'clxyz789',
  managerId: 'clxyz123',
  name: 'Tasty Bites',
  description: 'Best North Indian food in town',
  image: 'https://example.com/logo.jpg',
  costForTwo: 500,
  cuisineTypes: ['North Indian', 'Chinese'],
  address: '123, Main Street, City',
  lat: 12.9716,
  lng: 77.5946,
  isActive: true,
  isOpen: true,
  isVerified: false,
  rating: 4.3,
  ratingCount: 120,
  fssaiCode: '12345678901234',
  gstNumber: '29ABCDE1234F1Z5',
  type: null,
  createdAt: '2026-02-20T12:00:00.000Z',
  updatedAt: '2026-02-20T12:00:00.000Z',
};

@ApiTags('Discover & Order')
@Controller('api/restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) { }

  // ─── PUBLIC: SEARCH ───────────────────────────────────────────────────────
  @Get('search')
  @ApiOperation({
    summary: 'Search restaurants & dishes with advanced sorting',
    description: 'Search by restaurant name, dish name, or popular items. Filter by food type (VEG/NON_VEG) and minimum rating. You can also sort by `rating`, `costForTwo`, or `deliveryTime`. If sorting by deliveryTime, you must provide `userLat` and `userLng`.'
  })
  @ApiQuery({ name: 'query', required: false, example: 'Paneer', description: 'Restaurant or dish name' })
  @ApiQuery({ name: 'type', required: false, enum: ['VEG', 'NON_VEG'], description: 'Filter by food type' })
  @ApiQuery({ name: 'minRating', required: false, example: 4.0, description: 'Minimum rating (0–5)' })
  @ApiResponse({
    status: 200,
    description: 'Matching restaurants',
    schema: { example: [RestaurantExample] }
  })
  async search(@Query() dto: SearchRestaurantsDto) {
    return this.restaurantsService.search(dto);
  }

  // ─── PUBLIC: LIST ALL ─────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List all restaurants',
    description: 'Returns all active restaurants. Used for the home screen listing with name, rating, and cuisine type.'
  })
  @ApiResponse({
    status: 200,
    description: 'List of restaurants',
    schema: { example: [RestaurantExample] }
  })
  async findAll(@Query() dto: PaginationDto) {
    return this.restaurantsService.findAll(dto);
  }

  // ─── PUBLIC: GET ONE ──────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Get restaurant details',
    description: 'Returns the full detail page for a restaurant including all menu categories and items.'
  })
  @ApiParam({ name: 'id', example: 'clxyz789', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant detail with full menu',
    schema: { example: { ...RestaurantExample, menuCategories: [] } }
  })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async findOne(@Param('id') id: string) {
    return this.restaurantsService.findOne(id);
  }

  // ─── MANAGER: CREATE ──────────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Register a restaurant',
    description: 'Create a new restaurant profile. Only users with `RESTAURANT_MANAGER` or `ADMIN` role can do this.'
  })
  @ApiBody({ type: CreateRestaurantDto })
  @ApiResponse({
    status: 201,
    description: 'Restaurant created successfully',
    schema: { example: RestaurantExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER or ADMIN role' })
  async create(
    @Body() dto: CreateRestaurantDto,
    @Req() req: AuthenticatedRequest
  ): Promise<Restaurant> {
    return this.restaurantsService.create(dto, req.user.id);
  }

  // ─── MANAGER: UPDATE ──────────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Update restaurant profile',
    description: 'Edit any restaurant details such as logo, description, timing flags, or contact info. All fields are optional.'
  })
  @ApiParam({ name: 'id', example: 'clxyz789', description: 'Restaurant ID to update' })
  @ApiBody({ type: UpdateRestaurantDto })
  @ApiResponse({
    status: 200,
    description: 'Restaurant updated successfully',
    schema: { example: RestaurantExample }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER or ADMIN role' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateRestaurantDto) {
    return this.restaurantsService.update(id, updateDto);
  }

  // ─── ADMIN: DELETE ────────────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Delete a restaurant',
    description: 'Permanently removes a restaurant and all its data. Admin only.'
  })
  @ApiParam({ name: 'id', example: 'clxyz789', description: 'Restaurant ID to delete' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant deleted successfully',
    schema: { example: { message: 'Restaurant deleted' } }
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }
}