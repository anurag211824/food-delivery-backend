import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsArray, IsEnum, IsString } from 'class-validator';

export class BulkUpdateOrderStatusDto {
  @ApiProperty({ type: [String], description: 'List of Order IDs to update' })
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  @ApiProperty({ enum: OrderStatus, description: 'Target status' })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
