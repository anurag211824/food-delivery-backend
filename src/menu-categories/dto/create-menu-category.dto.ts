import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VegType } from '@prisma/client';

export class CreateMenuCategoryDto {
  @ApiProperty({
    example: 'Main Course',
    description: 'Name of the menu category',
  })
  @IsString()
  @IsNotEmpty()
  name!: string; // e.g., "Recommended", "Main Course", "Drinks"

  @ApiProperty({
    example: 'https://example.com/category-image.jpg',
    description: 'Image URL for the menu category',
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ example: 'VEG', description: 'VegType of the menu category' })
  @IsEnum(VegType)
  @IsOptional()
  type?: VegType;

  @ApiProperty({
    example: 'clxyz789',
    description: 'Restaurant ID (Optional, used by Admin)',
  })
  @IsString()
  @IsOptional()
  restaurantId?: string;
}
