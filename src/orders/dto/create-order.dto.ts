import { IsArray, IsString, IsNotEmpty, ValidateNested, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

class OrderItemDto {
  @ApiProperty({ example: 'menu_item_id_123' })
  @IsString()
  @IsNotEmpty()
  menuItemId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'restaurant_id_456' })
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: 'COD' })
  @IsEnum(PaymentMethod)
  paymentMode: PaymentMethod;
}