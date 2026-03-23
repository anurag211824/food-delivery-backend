jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {},
}));

import { OrdersController } from './orders.controller';
import { OrderStatus } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: {
    updateStatus: jest.Mock;
  };

  beforeEach(() => {
    ordersService = {
      updateStatus: jest.fn(),
    };

    controller = new OrdersController(ordersService as any);
  });

  it('passes the dto status and authenticated user to the service', async () => {
    const req = {
      user: {
        id: 'manager-1',
        role: 'RESTAURANT_MANAGER',
      },
    } as any;

    await controller.updateStatus(
      'order-1',
      { status: OrderStatus.ACCEPTED },
      req,
    );

    expect(ordersService.updateStatus).toHaveBeenCalledWith(
      'order-1',
      OrderStatus.ACCEPTED,
      req.user,
    );
  });
});
