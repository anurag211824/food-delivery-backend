import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService], // Exported so OrdersModule can use it
})
export class CouponsModule {}
