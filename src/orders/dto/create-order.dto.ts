import { IsArray, IsString, IsNotEmpty, ValidateNested, IsInt, Min, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, OrderType } from '@prisma/client';

// ─── Selected Addon DTO ─────────────────────────────────────────────────────

class OrderItemAddonDto {
  @ApiProperty({ example: 'addon_option_id_123', description: 'ID of the selected AddonOption' })
  @IsString()
  @IsNotEmpty()
  addonOptionId: string;

  @ApiPropertyOptional({ example: 1, description: 'Quantity of this addon (default 1)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

// ─── Order Item DTO ─────────────────────────────────────────────────────────

export class OrderItemDto {
  @ApiPropertyOptional({ example: 'menu_item_id_123', description: 'ID of the MenuItem (for FOOD orders)' })
  @IsString()
  @IsOptional()
  menuItemId?: string;

  @ApiPropertyOptional({ example: 'product_id_789', description: 'ID of the Product (for GROCERY orders)' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ example: 'variant_id_456', description: 'ID of the selected MenuVariant. Required if item has variants.' })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ example: 2, description: 'Quantity of this item' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    type: [OrderItemAddonDto],
    description: 'Selected addons for this item (only for FOOD orders)'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemAddonDto)
  @IsOptional()
  selectedAddons?: OrderItemAddonDto[];
}

// ─── Main Order DTO ─────────────────────────────────────────────────────────

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'restaurant_id_456', description: 'Required for FOOD orders' })
  @IsString()
  @IsOptional()
  restaurantId?: string;

  @ApiPropertyOptional({ example: 'store_id_789', description: 'Required for GROCERY orders' })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional({ enum: OrderType, example: 'FOOD' })
  @IsEnum(OrderType)
  @IsOptional()
  orderType?: OrderType;

  @ApiProperty({ type: [OrderItemDto], description: 'Items to order with variant and addon selections' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: 'COD' })
  @IsEnum(PaymentMethod)
  paymentMode: PaymentMethod;

  @ApiPropertyOptional({ example: 'WELCOME50', description: 'Promo code to apply' })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ example: 'address_id_789' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ example: 20, description: 'Tip amount for the driver' })
  @IsOptional()
  @IsInt()
  @Min(0)
  driverTip?: number;
}