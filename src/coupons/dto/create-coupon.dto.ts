import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ example: 'SAVE50' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FLAT'], example: 'PERCENTAGE' })
  @IsString()
  @IsNotEmpty()
  discountType: string;

  @ApiProperty({
    example: 20,
    description: '20 means 20% off or ₹20 off depending on type',
  })
  @IsNumber()
  discountValue: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Max discount cap for percentage coupons',
  })
  @IsOptional()
  @IsNumber()
  maxDiscount?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Minimum order amount to apply',
  })
  @IsOptional()
  @IsNumber()
  minOrder?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Total usage limit across all users',
  })
  @IsOptional()
  @IsInt()
  usageLimit?: number;

  @ApiPropertyOptional({ example: 1, description: 'Max uses per single user' })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  @IsDateString()
  validTo: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;
}
