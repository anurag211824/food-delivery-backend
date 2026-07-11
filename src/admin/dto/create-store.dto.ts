import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ example: 'Instamart Dark Store - Koramangala' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Ultra-fast delivery dark store for groceries.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.jpg' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @ApiProperty({ example: '12, 80 Feet Road, Koramangala, Bengaluru' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 12.9352 })
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 77.6245 })
  @IsNumber()
  @IsNotEmpty()
  lng: number;

  @ApiProperty({ example: 'user_cuid_123', description: 'ID of the User who will manage this store' })
  @IsString()
  @IsNotEmpty()
  managerId: string;
}
