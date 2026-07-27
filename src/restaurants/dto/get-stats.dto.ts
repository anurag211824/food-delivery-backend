import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum StatsPeriod {
  TODAY = 'Today',
  WEEK = 'Week',
  MONTH = 'Month',
  YEAR = 'Year',
}

export class GetStatsDto {
  @ApiPropertyOptional({ enum: StatsPeriod, default: StatsPeriod.WEEK })
  @IsEnum(StatsPeriod)
  @IsOptional()
  period?: StatsPeriod = StatsPeriod.WEEK;

  @ApiPropertyOptional({ description: 'Dark store ID (optional, for Admin or Store Manager)' })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Restaurant ID (optional, for Admin or Restaurant Manager)' })
  @IsString()
  @IsOptional()
  restaurantId?: string;
}

