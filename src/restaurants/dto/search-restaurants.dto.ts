import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer'; // 👈 Add this import
import { PaginationDto } from 'src/common/pagination.dto';

export class SearchRestaurantsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Paneer', description: 'Search by restaurant or dish name' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ example: 'VEG', enum: ['VEG', 'NON_VEG'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 4.0 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ example: 'rating', enum: ['rating', 'costForTwo', 'deliveryTime'], description: 'Sort criteria' })
  @IsString()
  @IsOptional()
  sortBy?: 'rating' | 'costForTwo' | 'deliveryTime';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'], description: 'Sort order' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: 12.9716, description: 'User latitude for delivery time sorting' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  userLat?: number;

  @ApiPropertyOptional({ example: 77.5946, description: 'User longitude for delivery time sorting' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  userLng?: number;
}