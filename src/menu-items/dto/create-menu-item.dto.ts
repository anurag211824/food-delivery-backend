import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VegType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ──────────────────────────────────────────────────────────────

export class CreateAddonOptionDto {
    @ApiProperty({ example: 'Extra Cheese', description: 'Name of the addon option' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 50, description: 'Price of the addon option' })
    @IsNumber()
    @Min(0)
    price: number;

    @ApiPropertyOptional({ example: true, description: 'Is this addon available?' })
    @IsBoolean()
    @IsOptional()
    isAvailable?: boolean;
}

export class CreateAddonGroupDto {
    @ApiProperty({ example: 'Extra Toppings', description: 'Name of the addon group' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 0, description: 'Minimum selections required' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    minSelect?: number;

    @ApiPropertyOptional({ example: 5, description: 'Maximum selections allowed' })
    @IsNumber()
    @IsOptional()
    maxSelect?: number;

    @ApiProperty({ type: [CreateAddonOptionDto], description: 'Options within this addon group' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateAddonOptionDto)
    options: CreateAddonOptionDto[];
}

export class CreateMenuVariantDto {
    @ApiProperty({ example: 'Regular', description: 'Variant name (Small, Medium, Large, Half, Full)' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 199, description: 'Base price of this variant' })
    @IsNumber()
    @Min(0)
    price: number;

    @ApiPropertyOptional({ example: 149, description: 'Discounted sale price (if any)' })
    @IsNumber()
    @IsOptional()
    salePrice?: number;

    @ApiPropertyOptional({ example: '8 inch', description: 'Quantity descriptor (250ml, 500g, 2 pcs)' })
    @IsString()
    @IsOptional()
    quantity?: string;

    @ApiPropertyOptional({ example: 'Serves 1', description: 'Serving size descriptor' })
    @IsString()
    @IsOptional()
    servingSize?: string;

    @ApiPropertyOptional({ example: true, description: 'Is this the default variant shown to customers?' })
    @IsBoolean()
    @IsOptional()
    isDefault?: boolean;

    @ApiPropertyOptional({ example: true, description: 'Is this variant currently available?' })
    @IsBoolean()
    @IsOptional()
    isAvailable?: boolean;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

export class CreateMenuItemDto {
    @ApiProperty({ example: 'uuid-category-id', description: 'ID of the menu category this item belongs to' })
    @IsString()
    @IsNotEmpty()
    categoryId: string;

    @ApiProperty({ example: 'Butter Chicken', description: 'Name of the dish' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Creamy tomato based curry', description: 'Description of the dish' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'NON_VEG', enum: VegType, description: 'Dietary type' })
    @IsEnum(VegType)
    @IsNotEmpty()
    type: VegType;

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
    prepTime?: number;

    // ─── Variants (at least one required for proper pricing) ─────────────────

    @ApiPropertyOptional({
        type: [CreateMenuVariantDto],
        description: 'Menu variants with pricing. If omitted, a default variant is created from the legacy `price` field.'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateMenuVariantDto)
    @IsOptional()
    variants?: CreateMenuVariantDto[];

    // ─── Addons (optional) ──────────────────────────────────────────────────

    @ApiPropertyOptional({
        type: [CreateAddonGroupDto],
        description: 'Addon groups (e.g. Extra Toppings) with their options'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateAddonGroupDto)
    @IsOptional()
    addons?: CreateAddonGroupDto[];

    // ─── Backward Compat: Legacy `price` field ──────────────────────────────
    // If an old client sends `price` instead of `variants`, the service layer
    // auto-creates a "Default" variant with this price.

    @ApiPropertyOptional({ example: 350, description: '(Legacy) Price — auto-creates a Default variant if `variants` is not provided' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    price?: number;
}