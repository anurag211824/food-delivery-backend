import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean, Min } from 'class-validator';
import { VegType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMenuItemDto {
    @ApiProperty({ example: 'uuid-category-id', description: 'ID of the menu category this item belongs to' })
    @IsString()
    @IsNotEmpty()
    categoryId: string; // 👈 Required to link to a Category (Starters/Mains)

    @ApiProperty({ example: 'Butter Chicken', description: 'Name of the dish' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Creamy tomato based curry', description: 'Description of the dish' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 350, description: 'Price of the dish' })
    @IsNumber()
    @Min(0)
    price: number;

    @ApiProperty({ example: 'NON_VEG', enum: VegType, description: 'Dietary type' })
    @IsEnum(VegType)
    @IsNotEmpty()
    type: VegType; // 👈 Changed from vegType to type to match Schema

    @ApiPropertyOptional({ example: 'https://example.com/food.jpg', description: 'Image URL' })
    @IsString()
    @IsOptional()
    image?: string;

    @ApiPropertyOptional({ example: true, description: 'Is this a bestseller?' })
    @IsBoolean()
    @IsOptional()
    isBestseller?: boolean;

    @ApiPropertyOptional({ example: 'Medium', description: 'Spice level (Mild, Medium, Hot)' })
    @IsString()
    @IsOptional()
    spiceLevel?: string;

    @ApiPropertyOptional({ example: 20, description: 'Preparation time in minutes' })
    @IsNumber()
    @IsOptional()
    prepTime?: number; // Added this as it's in your schema
}