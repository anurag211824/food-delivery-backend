import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class DashboardQueryDto {
    @ApiPropertyOptional({
        description: 'Start date for filtering orders. Defaults to the beginning of the current day.',
        example: '2026-03-01T00:00:00.000Z',
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    startDate?: Date;

    @ApiPropertyOptional({
        description: 'End date for filtering orders. Defaults to the current time.',
        example: '2026-03-10T23:59:59.999Z',
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDate?: Date;
}
