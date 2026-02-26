import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateReviewDto) {
    // 1. Validate Order
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        restaurant: true,
        driver: true,
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== userId) {
      throw new BadRequestException('You did not place this order');
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('You can only review delivered orders');
    }

    // 2. Check if already reviewed
    const existingReview = await this.prisma.review.findUnique({
      where: { orderId: dto.orderId },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this order');
    }

    // 3. Atomically create review and update ratings
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          orderId: order.id,
          userId: userId,
          restaurantId: order.restaurantId,
          foodRating: dto.foodRating,
          deliveryRating: dto.deliveryRating,
          comment: dto.comment,
        },
      });

      // Recalculate Restaurant Rating
      const newRestCount = order.restaurant.ratingCount + 1;
      const newRestRating = ((order.restaurant.rating * order.restaurant.ratingCount) + dto.foodRating) / newRestCount;

      await tx.restaurant.update({
        where: { id: order.restaurantId },
        data: {
          rating: newRestRating,
          ratingCount: newRestCount,
        },
      });

      // Recalculate Driver Rating if a driver exists
      if (order.driver) {
        const newDriverCount = order.driver.ratingCount + 1;
        const newDriverRating = ((order.driver.rating * order.driver.ratingCount) + dto.deliveryRating) / newDriverCount;

        await tx.driverProfile.update({
          where: { id: order.driver.id },
          data: {
            rating: newDriverRating,
            ratingCount: newDriverCount,
          },
        });
      }

      return review;
    });
  }

  async findRestaurantReviews(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      throw new NotFoundException("Restaurant not found.");
    }

    return this.prisma.review.findMany({
      where: { restaurantId },
      include: {
        user: {
          select: { name: true, image: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
