import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StoreInventoryService } from './store-inventory.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

@ApiTags('Store Inventory & Catalog Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('api/store-inventory')
export class StoreInventoryController {
  constructor(private readonly inventoryService: StoreInventoryService) {}

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  @Post('categories')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Create a custom store category' })
  @ApiBody({ schema: { example: { name: 'Fresh Fruits', image: 'url_to_image', parentCategoryId: 'optional_parent_id' } } })
  @ApiResponse({ status: 201, description: 'Category created.' })
  async createCategory(@Body() dto: any, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.createCategory(req.user.id, dto);
  }

  @Patch('categories/:id')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Update a store category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiBody({ schema: { example: { name: 'Fresh Vegetables' } } })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.updateCategory(req.user.id, id, dto);
  }

  @Delete('categories/:id')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Delete a store category and its subcategories' })
  @ApiParam({ name: 'id' })
  async deleteCategory(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.deleteCategory(req.user.id, id);
  }

  @Get('categories')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] List all categories at my store' })
  async listCategories(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.listCategories(req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL CATALOG MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  @Post('global-catalog')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager/Admin] Register a new product globally' })
  @ApiBody({ schema: { example: { name: 'Coca Cola 250ml', brand: 'Coca Cola', weight: '250ml', unit: 'ml', sku: 'COCA-COLA-250ML', barcode: '8901764012219' } } })
  async createGlobalProduct(@Body() dto: any) {
    return this.inventoryService.createGlobalProduct(dto);
  }

  @Get('global-catalog/search')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Search items in global product catalog' })
  @ApiQuery({ name: 'query', required: false, description: 'Search name, brand, SKU or barcode' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchGlobalCatalog(
    @Query('query') query = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.inventoryService.searchGlobalCatalog(query, page, limit);
  }

  // ═══════════════════════════════════════════════════════════════
  // STORE INVENTORY ACTIONS
  // ═══════════════════════════════════════════════════════════════

  @Post('items')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Link global product to store inventory' })
  @ApiBody({ schema: { example: { productId: 'prod_cuid', categoryId: 'cat_cuid', stock: 100, price: 40.00 } } })
  async addProductToInventory(@Body() dto: any, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.addProductToInventory(req.user.id, dto);
  }

  @Patch('items/:id')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Update stock/price of inventory item' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiBody({ schema: { example: { stock: 120, price: 45.00 } } })
  async updateInventoryItem(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.updateInventoryItem(req.user.id, id, dto);
  }

  @Delete('items/:id')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] Remove item from store inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  async removeProductFromInventory(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.removeProductFromInventory(req.user.id, id);
  }

  @Get('items')
  @Roles(Role.STORE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '[Store Manager] List all items in store inventory' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Search by product name or brand' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getStoreInventory(
    @Req() req: AuthenticatedRequest,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.inventoryService.getStoreInventory(req.user.id, {
      categoryId,
      search,
      page,
      limit,
    });
  }
}
