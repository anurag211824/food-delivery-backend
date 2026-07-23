import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let eventsGateway: {
    emitOrderStatusChange: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    eventsGateway = {
      emitOrderStatusChange: jest.fn(),
    };

    service = new OrdersService(
      prisma as any,
      {} as any,
      eventsGateway as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('allows an admin to update another restaurant order status', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PLACED',
      restaurant: { managerId: 'manager-1' },
    });

    const updatedOrder = { id: 'order-1', status: 'ACCEPTED' };
    prisma.order.update.mockResolvedValue(updatedOrder);

    const result = await service.updateStatus('order-1', OrderStatus.ACCEPTED, {
      id: 'admin-1',
      role: Role.ADMIN,
    });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'ACCEPTED',
        acceptedAt: expect.any(Date),
      }),
    });
    expect(eventsGateway.emitOrderStatusChange).toHaveBeenCalledWith(
      'order-1',
      'ACCEPTED',
    );
    expect(result).toBe(updatedOrder);
  });

  it('rejects invalid status jumps', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PLACED',
      restaurant: { managerId: 'manager-1' },
    });

    await expect(
      service.updateStatus('order-1', OrderStatus.DELIVERED, {
        id: 'manager-1',
        role: Role.RESTAURANT_MANAGER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(eventsGateway.emitOrderStatusChange).not.toHaveBeenCalled();
  });

  it('rejects managers from other restaurants', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PLACED',
      restaurant: { managerId: 'manager-1' },
    });

    await expect(
      service.updateStatus('order-1', OrderStatus.ACCEPTED, {
        id: 'manager-2',
        role: Role.RESTAURANT_MANAGER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('throws when the order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing-order', OrderStatus.ACCEPTED, {
        id: 'admin-1',
        role: Role.ADMIN,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets pickedUpAt when moving to PICKED_UP', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'READY',
      restaurant: { managerId: 'manager-1' },
    });

    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'PICKED_UP',
    });

    await service.updateStatus('order-1', OrderStatus.PICKED_UP, {
      id: 'manager-1',
      role: Role.RESTAURANT_MANAGER,
    });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'PICKED_UP',
        pickedUpAt: expect.any(Date),
      }),
    });
  });
});
