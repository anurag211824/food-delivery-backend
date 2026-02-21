import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) { }

  async create(userId: string, dto: CreateOrderDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) throw new NotFoundException("Restaurant not found");
    if (!restaurant.isOpen) throw new BadRequestException("Restaurant is closed");

    // Fetch real prices from database
    const dbItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: dto.items.map((i) => i.menuItemId) },
        category: {
          restaurantId: dto.restaurantId,
        },
      },
    });

    if (dbItems.length !== dto.items.length) {
      throw new BadRequestException("Some items are invalid");
    }

    // Perform calculations
    let itemTotal = 0;

    // We explicitly define the return type to satisfy Prisma's create requirements
    const orderItemsData = dto.items.map((item) => {
      const dbItem = dbItems.find((d) => d.id === item.menuItemId);

      // Fix: dbItem is guaranteed to exist because of the length check above
      const price = dbItem!.price;

      itemTotal += price * item.quantity;

      return {
        quantity: item.quantity,
        price: price, // This is the 'snapshot' price
        // Fix: Use 'menuItemId' instead of trying to map the whole 'menuItem' object
        menuItemId: item.menuItemId,
      };
    });

    const tax = itemTotal * 0.05;
    const deliveryCharge = 30;
    const platformFee = 5;
    const totalAmount = itemTotal + tax + deliveryCharge + platformFee;

    // 4. Create Order and Items in one Transaction
    return this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId: userId,
          restaurantId: dto.restaurantId,
          status: 'PLACED',
          itemTotal,
          tax,
          deliveryCharge,
          platformFee,
          totalAmount,
          paymentMode: dto.paymentMode,
          items: {
            // Fix: Ensure the data structure matches Prisma's expectation
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: { menuItem: true }
          }
        },
      });
    });
  }

  async updateStatus(orderId: string, status: OrderStatus, managerId: string) {

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: true
      }
    });

    if (!order) throw new NotFoundException("Order not found");

    if (order.restaurant.managerId !== managerId) {
      throw new ForbiddenException("You do not have permission to manage this restaurant")
    }

    // perform the update

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : undefined,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      }
    })


  }


  async getCustomerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: {
        restaurant: {
          select: { name: true, image: true, id: true }
        },
        items: {
          include: { menuItem: true }
        }
      },
      orderBy: { placedAt: 'desc' }
    });
  }


  async getRestaurantOrders(managerId: string){

    return this.prisma.order.findMany({
      where: {
        restaurant: {
          managerId: managerId,
        }
      }, 
      include: {
        customer: {
          select: { id: true, name : true, email: true},
        },
        items: {
          include: { menuItem: true},
        },
      },
      orderBy: { placedAt: 'desc' },
    })
  }



}
