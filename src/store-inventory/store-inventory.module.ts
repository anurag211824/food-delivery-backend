import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreInventoryController } from './store-inventory.controller';
import { StoreInventoryService } from './store-inventory.service';

@Module({
  imports: [PrismaModule],
  controllers: [StoreInventoryController],
  providers: [StoreInventoryService],
  exports: [StoreInventoryService],
})
export class StoreInventoryModule {}
