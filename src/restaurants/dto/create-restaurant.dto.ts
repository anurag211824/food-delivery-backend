import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Tasty Bites', description: 'Name of the restaurant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Best North Indian food in town', description: 'Short description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.jpg', description: 'Restaurant logo/image URL' })
  @IsString()
  @IsOptional()
  image?: string; // We'll handle file uploads later

  @ApiProperty({ example: 500, description: 'Average cost for two people' })
  @IsNumber()
  @Min(0)
  costForTwo: number;

  @ApiProperty({ example: ['North Indian', 'Chinese'], description: 'List of cuisines offered' })
  @IsArray()
  @IsString({ each: true })
  cuisineTypes: string[]; // e.g. ["Italian", "Mexican"]

  @ApiProperty({ example: '123, Main Street, City', description: 'Full readable address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 12.9716, description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 77.5946, description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ example: 'clxyz123', description: 'User ID who will manage this restaurant (Admin only override)' })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ example: '12345678901234', description: 'FSSAI License code' })
  @IsString()
  @IsOptional()
  fssaiCode?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1Z5', description: 'GST Number' })
  @IsString()
  @IsOptional()
  gstNumber?: string;
}