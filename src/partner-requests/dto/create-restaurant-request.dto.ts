import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';

export class CreateRestaurantRequestDto {
  @ApiProperty({
    example: "Priya's Kitchen",
    description: 'Proposed restaurant name',
  })
  @IsString()
  restaurantName!: string;

  @ApiPropertyOptional({
    example: 'Authentic North Indian home food',
    description: 'Short description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '123, MG Road, Delhi – 110001',
    description: 'Physical address of the restaurant',
  })
  @IsString()
  address!: string;

  @ApiProperty({
    example: 28.6139,
    description: 'Latitude of the restaurant location',
  })
  @IsNumber()
  lat!: number;

  @ApiProperty({
    example: 77.209,
    description: 'Longitude of the restaurant location',
  })
  @IsNumber()
  lng!: number;

  @ApiProperty({
    example: ['North Indian', 'Chinese'],
    description: 'List of cuisine types',
  })
  @IsArray()
  @IsString({ each: true })
  cuisineTypes!: string[];

  @ApiProperty({
    example: 400,
    description: 'Approximate cost for two people (in ₹)',
  })
  @IsInt()
  @Min(0)
  costForTwo!: number;

  @ApiProperty({
    example: '12345678901234',
    description: '14-digit FSSAI license number',
  })
  @IsString()
  fssaiCode!: string;

  @ApiPropertyOptional({
    example: '29ABCDE1234F1Z5',
    description: 'GST number (optional)',
  })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'https://cloudinary.com/mylogo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://cloudinary.com/mybanner.png' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiPropertyOptional({ example: 'https://cloudinary.com/fssai_doc.pdf' })
  @IsOptional()
  @IsString()
  fssaiDocUrl?: string;
}
