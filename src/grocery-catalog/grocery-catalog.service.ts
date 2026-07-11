import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroceryCatalogService {
  private readonly logger = new Logger(GroceryCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── GEOLOCATION STORE RESOLUTION ───────────────────────────────────────
  async findClosestStore(lat: number, lng: number) {
    const cacheKey = `closest_store:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const cachedStore = await this.cacheManager.get<any>(cacheKey);
    if (cachedStore) {
      return cachedStore;
    }

    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        isVerified: true,
      },
    });

    if (stores.length === 0) {
      return null;
    }

    // Haversine formula calculation
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    };

    const storesWithDistance = stores.map((store) => ({
      ...store,
      distanceKm: getDistance(lat, lng, store.lat, store.lng),
    }));

    // Find the closest active store within 10 km limit
    const activeStoresInRange = storesWithDistance
      .filter((s) => s.distanceKm <= 10)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const closestStore = activeStoresInRange[0] || null;

    if (closestStore) {
      // Cache the result for 3 minutes (180000 ms)
      await this.cacheManager.set(cacheKey, closestStore, 180000);
    }

    return closestStore;
  }

  // ─── GET STORE CATEGORY HIERARCHY ───────────────────────────────────────
  async getCategories(storeId: string) {
    const cacheKey = `store_categories:${storeId}`;
    const cachedCategories = await this.cacheManager.get<any>(cacheKey);
    if (cachedCategories) {
      return cachedCategories;
    }

    const categories = await this.prisma.storeCategory.findMany({
      where: {
        storeId,
        parentCategoryId: null, // Get root categories
      },
      include: {
        subCategories: true,
      },
      orderBy: { name: 'asc' },
    });

    // Cache categories for 10 minutes
    await this.cacheManager.set(cacheKey, categories, 600000);
    return categories;
  }

  // ─── GET PRODUCTS BY CATEGORY ──────────────────────────────────────────
  async getProductsByCategory(storeId: string, categoryId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    // Cache key specific to store, category, page, and limit
    const cacheKey = `products:${storeId}:${categoryId}:${page}:${limit}`;
    const cachedData = await this.cacheManager.get<any>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Get category first (to verify it exists and belongs to this store)
    const category = await this.prisma.storeCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.storeId !== storeId) {
      throw new NotFoundException(`Category with ID "${categoryId}" not found under this store.`);
    }

    // Find all inventory items for this category (or its subcategories)
    const categoryIds = [categoryId];
    const subCategories = await this.prisma.storeCategory.findMany({
      where: { parentCategoryId: categoryId },
      select: { id: true },
    });
    categoryIds.push(...subCategories.map((c) => c.id));

    const [inventoryItems, total] = await Promise.all([
      this.prisma.storeInventory.findMany({
        where: {
          storeId,
          categoryId: { in: categoryIds },
          isAvailable: true,
          product: {}, // exists
        },
        include: {
          product: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.storeInventory.count({
        where: {
          storeId,
          categoryId: { in: categoryIds },
          isAvailable: true,
        },
      }),
    ]);

    const result = {
      data: inventoryItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        brand: item.product.brand,
        description: item.product.description,
        image: item.product.image,
        weight: item.product.weight,
        unit: item.product.unit,
        price: item.price,
        salePrice: item.salePrice,
        stock: item.stock,
      })),
      total,
      page,
      limit,
    };

    // Cache products for 2 minutes (lower TTL since stock/price can change)
    await this.cacheManager.set(cacheKey, result, 120000);
    return result;
  }

  // ─── SEARCH PRODUCTS IN STORE ──────────────────────────────────────────
  async searchProducts(storeId: string, query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [inventoryItems, total] = await Promise.all([
      this.prisma.storeInventory.findMany({
        where: {
          storeId,
          isAvailable: true,
          product: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { barcode: query },
              { sku: query },
            ],
          },
        },
        include: {
          product: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.storeInventory.count({
        where: {
          storeId,
          isAvailable: true,
          product: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { barcode: query },
              { sku: query },
            ],
          },
        },
      }),
    ]);

    return {
      data: inventoryItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        brand: item.product.brand,
        description: item.product.description,
        image: item.product.image,
        weight: item.product.weight,
        unit: item.product.unit,
        price: item.price,
        salePrice: item.salePrice,
        stock: item.stock,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── GET DETAILED PRODUCT INFORMATION ──────────────────────────────────
  async getProductDetails(storeId: string, productId: string) {
    const inventoryItem = await this.prisma.storeInventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
      include: {
        product: true,
        category: true,
      },
    });

    if (!inventoryItem || !inventoryItem.isAvailable) {
      throw new NotFoundException(`Product with ID "${productId}" is not available in this store.`);
    }

    return {
      id: inventoryItem.id,
      productId: inventoryItem.productId,
      name: inventoryItem.product.name,
      brand: inventoryItem.product.brand,
      description: inventoryItem.product.description,
      image: inventoryItem.product.image,
      weight: inventoryItem.product.weight,
      unit: inventoryItem.product.unit,
      price: inventoryItem.price,
      salePrice: inventoryItem.salePrice,
      stock: inventoryItem.stock,
      category: inventoryItem.category
        ? {
            id: inventoryItem.category.id,
            name: inventoryItem.category.name,
          }
        : null,
    };
  }
}
