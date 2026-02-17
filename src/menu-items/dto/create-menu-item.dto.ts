import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean, Min } from 'class-validator';
import { VegType } from '@prisma/client'; 

export class CreateMenuItemDto {
    @IsString()
    @IsNotEmpty()
    categoryId: string; // 👈 Required to link to a Category (Starters/Mains)

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsEnum(VegType)
    @IsNotEmpty()
    type: VegType; // 👈 Changed from vegType to type to match Schema

    @IsString()
    @IsOptional()
    image?: string;

    @IsBoolean()
    @IsOptional()
    isBestseller?: boolean;

    @IsString()
    @IsOptional()
    spiceLevel?: string;
    
    @IsNumber()
    @IsOptional()
    prepTime?: number; // Added this as it's in your schema
}