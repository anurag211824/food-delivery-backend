import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GroceryCatalogController } from './grocery-catalog.controller';
import { GroceryCatalogService } from './grocery-catalog.service';

@Module({
  imports: [PrismaModule],
  controllers: [GroceryCatalogController],
  providers: [GroceryCatalogService],
  exports: [GroceryCatalogService],
})
export class GroceryCatalogModule {}
