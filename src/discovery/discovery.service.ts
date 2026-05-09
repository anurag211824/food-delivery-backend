import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) {}

  async getCuisines() {
    return this.prisma.cuisine.findMany({
      where: { isActive: true },
    });
  }

  async getRecentSearches(userId: string) {
    return this.prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async addRecentSearch(userId: string, query: string) {
    // Check if query already exists for user to avoid duplicates and update timestamp
    const existing = await this.prisma.recentSearch.findFirst({
      where: { userId, query },
    });

    if (existing) {
      return this.prisma.recentSearch.update({
        where: { id: existing.id },
        data: { createdAt: new Date() },
      });
    }

    return this.prisma.recentSearch.create({
      data: {
        userId,
        query,
      },
    });
  }

  async clearRecentSearches(userId: string) {
    return this.prisma.recentSearch.deleteMany({
      where: { userId },
    });
  }

  async getMenuItems() {
    const items = await this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        image: { not: null },
      },
      select: {
        id: true,
        name: true,
        image: true,
        price: true,
        category: {
          select: {
            restaurantId: true,
          },
        },
      },
      take: 30, // Show a good variety on search page
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      restaurantId: item.category.restaurantId,
    }));
  }
}
