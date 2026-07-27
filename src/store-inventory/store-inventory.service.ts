import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoreInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── VERIFY STORE MANAGER OWNERSHIP ──────────────────────────────────────
  private async getStoreForManager(managerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { managerId },
    });
    if (!store) {
      throw new NotFoundException('You do not have an active store profile.');
    }
    return store;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. CATEGORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async createCategory(
    managerId: string,
    dto: { name: string; image?: string; parentCategoryId?: string },
  ) {
    const store = await this.getStoreForManager(managerId);

    // If parentCategoryId is provided, verify it belongs to this store
    if (dto.parentCategoryId) {
      const parent = await this.prisma.storeCategory.findUnique({
        where: { id: dto.parentCategoryId },
      });
      if (!parent || parent.storeId !== store.id) {
        throw new BadRequestException('Invalid parent category.');
      }
    }

    return this.prisma.storeCategory.create({
      data: {
        name: dto.name,
        image: dto.image,
        storeId: store.id,
        parentCategoryId: dto.parentCategoryId,
      },
    });
  }

  async updateCategory(
    managerId: string,
    categoryId: string,
    dto: { name?: string; image?: string; parentCategoryId?: string },
  ) {
    const store = await this.getStoreForManager(managerId);

    const category = await this.prisma.storeCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.storeId !== store.id) {
      throw new NotFoundException('Category not found.');
    }

    if (dto.parentCategoryId) {
      const parent = await this.prisma.storeCategory.findUnique({
        where: { id: dto.parentCategoryId },
      });
      if (!parent || parent.storeId !== store.id) {
        throw new BadRequestException('Invalid parent category.');
      }
      if (dto.parentCategoryId === categoryId) {
        throw new BadRequestException('A category cannot be its own parent.');
      }
    }

    return this.prisma.storeCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.parentCategoryId !== undefined && {
          parentCategoryId: dto.parentCategoryId,
        }),
      },
    });
  }

  async deleteCategory(managerId: string, categoryId: string) {
    const store = await this.getStoreForManager(managerId);

    const category = await this.prisma.storeCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.storeId !== store.id) {
      throw new NotFoundException('Category not found.');
    }

    // Cascade delete is handled by Prisma relation onDelete: Cascade
    await this.prisma.storeCategory.delete({
      where: { id: categoryId },
    });

    return { message: 'Category and its subcategories deleted successfully.' };
  }

  async listCategories(managerId: string) {
    const store = await this.getStoreForManager(managerId);

    // Fetch top-level categories with subcategories nesting
    return this.prisma.storeCategory.findMany({
      where: {
        storeId: store.id,
        parentCategoryId: null,
      },
      include: {
        subCategories: {
          include: {
            subCategories: true, // Support up to 3 levels in listing
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. PRODUCT CATALOG & INVENTORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  // Create a product in global catalog (so it can be used by all dark stores)
  async createGlobalProduct(dto: {
    name: string;
    brand?: string;
    description?: string;
    image?: string;
    barcode?: string;
    sku?: string;
    weight?: string;
    unit?: string;
  }) {
    // Check if SKU or Barcode already exists
    if (dto.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });
      if (existing)
        throw new BadRequestException(
          `Product with SKU "${dto.sku}" already exists.`,
        );
    }
    if (dto.barcode) {
      const existing = await this.prisma.product.findUnique({
        where: { barcode: dto.barcode },
      });
      if (existing)
        throw new BadRequestException(
          `Product with Barcode "${dto.barcode}" already exists.`,
        );
    }

    return this.prisma.product.create({
      data: dto,
    });
  }

  // Search the global catalog (to let store managers find items to add to their inventory)
  async searchGlobalCatalog(query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { brand: { contains: query, mode: 'insensitive' as const } },
            { sku: { contains: query, mode: 'insensitive' as const } },
            { barcode: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: products, total, page, limit };
  }

  // Add a product from the global catalog into store's inventory
  async addProductToInventory(
    managerId: string,
    dto: {
      productId: string;
      categoryId?: string;
      stock: number;
      price: number;
      salePrice?: number;
      isAvailable?: boolean;
    },
  ) {
    const store = await this.getStoreForManager(managerId);

    // Verify product exists in global catalog
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product)
      throw new NotFoundException('Product not found in global catalog.');

    // Verify category if provided
    if (dto.categoryId) {
      const category = await this.prisma.storeCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category || category.storeId !== store.id) {
        throw new BadRequestException('Invalid category for this store.');
      }
    }

    // Check if already in inventory
    const existing = await this.prisma.storeInventory.findUnique({
      where: {
        storeId_productId: {
          storeId: store.id,
          productId: dto.productId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Product is already in your store inventory. Use update instead.',
      );
    }

    return this.prisma.storeInventory.create({
      data: {
        storeId: store.id,
        productId: dto.productId,
        categoryId: dto.categoryId,
        stock: dto.stock,
        price: dto.price,
        salePrice: dto.salePrice,
        isAvailable: dto.isAvailable ?? true,
      },
      include: { product: true, category: true },
    });
  }

  // Update stock, price, category, etc. of an existing inventory item
  async updateInventoryItem(
    managerId: string,
    inventoryId: string,
    dto: {
      categoryId?: string;
      stock?: number;
      price?: number;
      salePrice?: number;
      isAvailable?: boolean;
    },
  ) {
    const store = await this.getStoreForManager(managerId);

    const item = await this.prisma.storeInventory.findUnique({
      where: { id: inventoryId },
    });
    if (!item || item.storeId !== store.id) {
      throw new NotFoundException('Inventory item not found.');
    }

    if (dto.categoryId) {
      const category = await this.prisma.storeCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category || category.storeId !== store.id) {
        throw new BadRequestException('Invalid category for this store.');
      }
    }

    return this.prisma.storeInventory.update({
      where: { id: inventoryId },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
      },
      include: { product: true, category: true },
    });
  }

  // Remove a product from the store's inventory
  async removeProductFromInventory(managerId: string, inventoryId: string) {
    const store = await this.getStoreForManager(managerId);

    const item = await this.prisma.storeInventory.findUnique({
      where: { id: inventoryId },
    });
    if (!item || item.storeId !== store.id) {
      throw new NotFoundException('Inventory item not found.');
    }

    await this.prisma.storeInventory.delete({
      where: { id: inventoryId },
    });

    return { message: 'Product removed from store inventory.' };
  }

  // List all products currently in the store's inventory (paginated & searchable)
  async getStoreInventory(
    managerId: string,
    options: {
      categoryId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const store = await this.getStoreForManager(managerId);

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { storeId: store.id };

    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options.search) {
      where.product = {
        OR: [
          { name: { contains: options.search, mode: 'insensitive' as const } },
          { brand: { contains: options.search, mode: 'insensitive' as const } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.storeInventory.findMany({
        where,
        include: { product: true, category: true },
        skip,
        take: limit,
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.storeInventory.count({ where }),
    ]);

    return { data: items, total, page, limit };
  }
}
