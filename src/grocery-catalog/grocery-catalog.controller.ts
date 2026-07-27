import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  ParseFloatPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { GroceryCatalogService } from './grocery-catalog.service';

@ApiTags('Grocery Catalog (Instamart)')
@Controller('api/grocery')
export class GroceryCatalogController {
  constructor(private readonly catalogService: GroceryCatalogService) {}

  @Get('store-lookup')
  @ApiOperation({
    summary: 'Find the closest dark store',
    description:
      'Finds the closest active grocery store within a 10km radius of the given coordinates.',
  })
  @ApiQuery({ name: 'lat', type: Number, example: 12.9352 })
  @ApiQuery({ name: 'lng', type: Number, example: 77.6245 })
  @ApiResponse({
    status: 200,
    description: 'Closest store details returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'No active stores found within 10km.',
  })
  async storeLookup(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
  ) {
    const store = await this.catalogService.findClosestStore(lat, lng);
    if (!store) {
      throw new NotFoundException(
        'No active grocery stores found within 10km of your location.',
      );
    }
    return store;
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get store categories',
    description:
      'Returns the root categories and subcategories configured for a specific dark store.',
  })
  @ApiQuery({ name: 'storeId', type: String, example: 'store_cuid_123' })
  @ApiResponse({
    status: 200,
    description: 'Store categories returned successfully.',
  })
  async getCategories(@Query('storeId') storeId: string) {
    return this.catalogService.getCategories(storeId);
  }

  @Get('products')
  @ApiOperation({
    summary: 'Get products by category',
    description:
      'Returns a paginated list of products available in a specific store and category.',
  })
  @ApiQuery({ name: 'storeId', type: String, example: 'store_cuid_123' })
  @ApiQuery({ name: 'categoryId', type: String, example: 'category_cuid_123' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Category products returned successfully.',
  })
  async getProductsByCategory(
    @Query('storeId') storeId: string,
    @Query('categoryId') categoryId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.catalogService.getProductsByCategory(
      storeId,
      categoryId,
      page,
      limit,
    );
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search products in a store',
    description:
      'Searches products by name, brand, description, sku, or barcode inside a specific store.',
  })
  @ApiQuery({ name: 'storeId', type: String, example: 'store_cuid_123' })
  @ApiQuery({ name: 'query', type: String, example: 'milk' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully.',
  })
  async searchProducts(
    @Query('storeId') storeId: string,
    @Query('query') query: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.catalogService.searchProducts(storeId, query, page, limit);
  }

  @Get('products/:productId')
  @ApiOperation({
    summary: 'Get product details',
    description:
      'Returns the full details and inventory status of a product in a specific store.',
  })
  @ApiParam({ name: 'productId', type: String, example: 'product_cuid_123' })
  @ApiQuery({ name: 'storeId', type: String, example: 'store_cuid_123' })
  @ApiResponse({
    status: 200,
    description: 'Product details returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found or unavailable in the store.',
  })
  async getProductDetails(
    @Param('productId') productId: string,
    @Query('storeId') storeId: string,
  ) {
    return this.catalogService.getProductDetails(storeId, productId);
  }
}
