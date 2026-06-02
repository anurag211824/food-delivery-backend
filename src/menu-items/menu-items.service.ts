import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/** Standard deep include for all menu item queries */
const MENU_ITEM_INCLUDE = {
  category: true,
  variants: {
    orderBy: { isDefault: 'desc' as const },
  },
  addons: {
    include: {
      options: true,
    },
  },
} as const;

@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────
  async create(dto: CreateMenuItemDto, user: { id: string, role: string }) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: dto.categoryId },
      include: { restaurant: true }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (user.role !== 'ADMIN' && category.restaurant.managerId !== user.id) {
      throw new ForbiddenException("You do not have permission to add items to this category.");
    }

    // ─── Build variants data ──────────────────────────────────────────────
    let variantsData: any[];

    if (dto.variants && dto.variants.length > 0) {
      variantsData = dto.variants.map(v => ({
        name: v.name,
        price: v.price,
        salePrice: v.salePrice,
        quantity: v.quantity,
        servingSize: v.servingSize,
        isDefault: v.isDefault ?? false,
        isAvailable: v.isAvailable ?? true,
      }));
    } else if (dto.price !== undefined) {
      // Backward compat: old clients sending `price` → auto-create Default variant
      variantsData = [{
        name: 'Default',
        price: dto.price,
        isDefault: true,
        isAvailable: true,
      }];
    } else {
      throw new BadRequestException('Either `variants` array or `price` must be provided.');
    }

    // Ensure exactly one default variant
    const hasDefault = variantsData.some(v => v.isDefault);
    if (!hasDefault && variantsData.length > 0) {
      variantsData[0].isDefault = true;
    }

    // ─── Build addons data ────────────────────────────────────────────────
    const addonsData = (dto.addons ?? []).map(group => ({
      name: group.name,
      minSelect: group.minSelect ?? 0,
      maxSelect: group.maxSelect,
      options: {
        create: group.options.map(opt => ({
          name: opt.name,
          price: opt.price,
          isAvailable: opt.isAvailable ?? true,
        })),
      },
    }));

    // ─── Create with nested relations ─────────────────────────────────────
    const newItem = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        image: dto.image,
        type: dto.type,
        spiceLevel: dto.spiceLevel,
        isBestseller: dto.isBestseller ?? false,
        prepTime: dto.prepTime,
        categoryId: dto.categoryId,
        variants: {
          create: variantsData,
        },
        addons: {
          create: addonsData,
        },
      },
      include: MENU_ITEM_INCLUDE,
    });

    await this.cacheManager.clear();
    return newItem;
  }

  // ─── FIND ALL ──────────────────────────────────────────────────────────────
  async findAll() {
    return this.prisma.menuItem.findMany({
      include: MENU_ITEM_INCLUDE,
    });
  }

  // ─── FIND BY RESTAURANT ────────────────────────────────────────────────────
  async findAllByRestaurant(restaurantId: string) {
    return this.prisma.menuItem.findMany({
      where: {
        category: { restaurantId },
      },
      include: MENU_ITEM_INCLUDE,
    });
  }

  // ─── FIND ONE ──────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: MENU_ITEM_INCLUDE,
    });

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    return item;
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateMenuItemDto, user?: { id: string, role: string }) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: { include: { restaurant: true } },
        variants: true,
        addons: { include: { options: true } },
      },
    });

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    // Authorization: Manager can only edit own restaurant's items
    if (user && user.role !== 'ADMIN' && item.category.restaurant.managerId !== user.id) {
      throw new ForbiddenException("You do not have permission to edit this item.");
    }

    // ─── Update base fields ───────────────────────────────────────────────
    const { variants, addons, deleteVariantIds, deleteAddonGroupIds, deleteAddonOptionIds, price, ...baseFields } = dto;

    await this.prisma.$transaction(async (tx) => {
      // 1. Update base item fields
      if (Object.keys(baseFields).length > 0) {
        await tx.menuItem.update({
          where: { id },
          data: baseFields,
        });
      }

      // 2. Delete explicitly requested variants
      if (deleteVariantIds && deleteVariantIds.length > 0) {
        await tx.menuVariant.deleteMany({
          where: { id: { in: deleteVariantIds }, menuItemId: id },
        });
      }

      // 3. Delete explicitly requested addon options
      if (deleteAddonOptionIds && deleteAddonOptionIds.length > 0) {
        await tx.addonOption.deleteMany({
          where: { id: { in: deleteAddonOptionIds } },
        });
      }

      // 4. Delete explicitly requested addon groups
      if (deleteAddonGroupIds && deleteAddonGroupIds.length > 0) {
        await tx.addonGroup.deleteMany({
          where: { id: { in: deleteAddonGroupIds }, menuItemId: id },
        });
      }

      // 5. Upsert variants (id present → update, id absent → create)
      if (variants && variants.length > 0) {
        for (const v of variants) {
          if (v.id) {
            await tx.menuVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                price: v.price,
                salePrice: v.salePrice,
                quantity: v.quantity,
                servingSize: v.servingSize,
                isDefault: v.isDefault,
                isAvailable: v.isAvailable,
              },
            });
          } else {
            await tx.menuVariant.create({
              data: {
                menuItemId: id,
                name: v.name!,
                price: v.price!,
                salePrice: v.salePrice,
                quantity: v.quantity,
                servingSize: v.servingSize,
                isDefault: v.isDefault ?? false,
                isAvailable: v.isAvailable ?? true,
              },
            });
          }
        }
      } else if (price !== undefined) {
        // If legacy `price` is passed (meaning no variants array was submitted),
        // update the default variant's price, or create one if none exists.
        const defaultVariant = item.variants.find(v => v.isDefault);
        if (defaultVariant) {
          await tx.menuVariant.update({
            where: { id: defaultVariant.id },
            data: { price },
          });
        } else {
          await tx.menuVariant.create({
            data: {
              menuItemId: id,
              name: 'Default',
              price,
              isDefault: true,
              isAvailable: true,
            },
          });
        }
      }

      // 6. Upsert addon groups and their options
      if (addons && addons.length > 0) {
        for (const group of addons) {
          if (group.id) {
            // Update existing addon group
            await tx.addonGroup.update({
              where: { id: group.id },
              data: {
                name: group.name,
                minSelect: group.minSelect,
                maxSelect: group.maxSelect,
              },
            });

            // Upsert options within existing group
            if (group.options) {
              for (const opt of group.options) {
                if (opt.id) {
                  await tx.addonOption.update({
                    where: { id: opt.id },
                    data: {
                      name: opt.name,
                      price: opt.price,
                      isAvailable: opt.isAvailable,
                    },
                  });
                } else {
                  await tx.addonOption.create({
                    data: {
                      addonGroupId: group.id,
                      name: opt.name!,
                      price: opt.price!,
                      isAvailable: opt.isAvailable ?? true,
                    },
                  });
                }
              }
            }
          } else {
            // Create new addon group with its options
            await tx.addonGroup.create({
              data: {
                menuItemId: id,
                name: group.name!,
                minSelect: group.minSelect ?? 0,
                maxSelect: group.maxSelect,
                options: {
                  create: (group.options ?? []).map(opt => ({
                    name: opt.name!,
                    price: opt.price!,
                    isAvailable: opt.isAvailable ?? true,
                  })),
                },
              },
            });
          }
        }
      }
    });

    // Fetch and return the fully updated item
    const updatedItem = await this.prisma.menuItem.findUnique({
      where: { id },
      include: MENU_ITEM_INCLUDE,
    });

    await this.cacheManager.clear();
    return updatedItem;
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────
  async remove(id: string, user?: { id: string, role: string }) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { category: { include: { restaurant: true } } },
    });

    if (!item) {
      throw new NotFoundException("Menu item not found");
    }

    if (user && user.role !== 'ADMIN' && item.category.restaurant.managerId !== user.id) {
      throw new ForbiddenException("You do not have permission to delete this item.");
    }

    // Cascade will clean up variants, addons, and addon options
    const deletedItem = await this.prisma.menuItem.delete({
      where: { id },
    });

    await this.cacheManager.clear();
    return deletedItem;
  }
}
