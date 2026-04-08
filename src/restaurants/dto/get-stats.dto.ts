import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

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
}
