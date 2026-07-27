import { PartialType, OmitType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreateMenuItemDto,
  CreateMenuVariantDto,
  CreateAddonGroupDto,
  CreateAddonOptionDto,
} from './create-menu-item.dto';

// ─── Variant Update DTO (includes optional `id` for existing variants) ──────

export class UpdateMenuVariantDto extends PartialType(CreateMenuVariantDto) {
  @ApiPropertyOptional({
    example: 'clvariant123',
    description: 'ID of existing variant to update. Omit to create new.',
  })
  @IsString()
  @IsOptional()
  id?: string;
}

// ─── Addon Option Update DTO ────────────────────────────────────────────────

export class UpdateAddonOptionDto extends PartialType(CreateAddonOptionDto) {
  @ApiPropertyOptional({
    example: 'claddon123',
    description: 'ID of existing addon option. Omit to create new.',
  })
  @IsString()
  @IsOptional()
  id?: string;
}

// ─── Addon Group Update DTO ─────────────────────────────────────────────────

export class UpdateAddonGroupDto {
  @ApiPropertyOptional({
    example: 'clgroup123',
    description: 'ID of existing addon group. Omit to create new.',
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ example: 'Extra Toppings' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minSelect?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  maxSelect?: number;

  @ApiPropertyOptional({
    type: [UpdateAddonOptionDto],
    description:
      'Options to create/update. Missing existing options will be deleted.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAddonOptionDto)
  @IsOptional()
  options?: UpdateAddonOptionDto[];
}

// ─── Main Update DTO ────────────────────────────────────────────────────────

export class UpdateMenuItemDto extends PartialType(
  OmitType(CreateMenuItemDto, ['variants', 'addons', 'price'] as const),
) {
  @ApiPropertyOptional({
    example: 350,
    description:
      '(Legacy) Price — updates the default variant if `variants` is not provided',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    type: [UpdateMenuVariantDto],
    description:
      'Variants to create/update. Include `id` to update existing. Existing variants not in this array will be deleted.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMenuVariantDto)
  @IsOptional()
  variants?: UpdateMenuVariantDto[];

  @ApiPropertyOptional({
    type: [UpdateAddonGroupDto],
    description:
      'Addon groups to create/update. Include `id` to update existing. Existing groups not in this array will be deleted.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAddonGroupDto)
  @IsOptional()
  addons?: UpdateAddonGroupDto[];

  @ApiPropertyOptional({ description: 'IDs of variants to delete explicitly' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deleteVariantIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs of addon groups to delete explicitly',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deleteAddonGroupIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs of addon options to delete explicitly',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deleteAddonOptionIds?: string[];
}
