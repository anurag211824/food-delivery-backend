import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { GetStatsDto } from './dto/get-stats.dto';
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
  @UseInterceptors(CacheInterceptor)
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
    description: 'Matching dishes grouped by name',
    schema: {
      example: {
        searchTerm: 'Chicken',
        totalUniqueDishes: 2,
        results: [
          {
            dishId: 'dish_butter_chicken',
            dishName: 'Butter Chicken',
            categoryName: 'North Indian',
            dishDetails: {
              description: 'Creamy tomato sauce with tandoori chicken',
              image: 'https://example.com/butter_chicken.jpg',
              type: 'NON_VEG',
              spiceLevel: 'Medium',
              prepTime: 25,
              isAvailable: true,
              avgPrice: 340.0,
              popularChoice: true
            },
            restaurants: [
              {
                restaurantId: 'res_123',
                name: 'Flavors of India',
                logo: 'https://example.com/logo.jpg',
                rating: 4.5,
                ratingCount: 112,
                costForTwo: 1200,
                menuItemId: 'mi_0123',
                price: 350.0,
                isBestseller: true,
                estimatedDelivery: '35-40 mins'
              }
            ]
          }
        ]
      }
    }
  })
  async search(@Query() dto: SearchRestaurantsDto) {
    return this.restaurantsService.search(dto);
  }

  // ─── PUBLIC: LIST ALL ─────────────────────────────────────────────────────
  @UseInterceptors(CacheInterceptor)
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

  // ─── MANAGER: STATS PAGE ─────────────────────────────────────────────────
  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Get Restaurant Stats (Manager Only)',
    description: 'Full analytics: KPIs with trend comparison, revenue chart, top items, payment breakdown, and ratings.'
  })
  @ApiResponse({ status: 200, description: 'Stats data' })
  async getStats(
    @Query() dto: GetStatsDto,
    @Req() req: AuthenticatedRequest,
    @Query('restaurantId') restaurantId?: string
  ) {
    return this.restaurantsService.getStats(req.user, dto.period, restaurantId);
  }

  // ─── MANAGER: DASHBOARD ───────────────────────────────────────────────────
  @Get('dashboard')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Get Restaurant Dashboard Analytics (Manager Only)',
    description: 'Fetch total orders, revenue, and active orders. By default returns today\'s data, but accepts optional `startDate` and `endDate` query parameters for custom ranges.'
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  async getDashboard(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
    @Query('restaurantId') restaurantId?: string
  ) {
    return this.restaurantsService.getDashboardStats(req.user, query.startDate, query.endDate, restaurantId);
  }

  // ─── MANAGER: GET MY RESTAURANT ───────────────────────────────────────────
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Get my restaurant details',
    description: 'Returns the full detail page for the restaurant belonging to the currently logged in manager.'
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurant detail with full menu',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires RESTAURANT_MANAGER role' })
  @ApiResponse({ status: 404, description: 'You do not possess a registered restaurant profile.' })
  async findMyRestaurant(
    @Req() req: AuthenticatedRequest,
    @Query('restaurantId') restaurantId?: string
  ) {
    return this.restaurantsService.findMyRestaurant(req.user, restaurantId);
  }

  // ─── MANAGER: SETTLEMENTS ─────────────────────────────────────────────────
  @Get('settlements')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Get Restaurant Settlements (Manager Only)',
    description: 'Returns a paginated list of all nightly settlements for this restaurant.'
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getMySettlements(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req: AuthenticatedRequest
  ) {
    return this.restaurantsService.getMySettlements(
      req.user,
      Math.max(1, parseInt(page, 10)),
      Math.min(100, Math.max(1, parseInt(limit, 10)))
    );
  }

  // ─── PUBLIC: GET ONE ──────────────────────────────────────────────────────
  @UseInterceptors(CacheInterceptor)
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
    return this.restaurantsService.create(dto, req.user);
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
  async update(@Param('id') id: string, @Body() updateDto: UpdateRestaurantDto, @Req() req: AuthenticatedRequest) {
    return this.restaurantsService.update(id, updateDto, req.user);
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