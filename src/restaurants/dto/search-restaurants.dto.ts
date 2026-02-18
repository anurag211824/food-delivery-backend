import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer'; // 👈 Add this import

export class SearchRestaurantsDto {
  @ApiPropertyOptional({ example: 'Paneer', description: 'Search by restaurant or dish name' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ example: 'VEG', enum: ['VEG', 'NON_VEG'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 4.0 })
  @Type(() => Number) // 👈 CRITICAL: Transforms the query string to a number
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  minRating?: number;
}