import { IsInt, IsOptional, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
    @ApiProperty({ example: 'clqxxxxxx', description: 'The ID of the order being reviewed' })
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @ApiProperty({ example: 5, description: 'Rating for the food/restaurant (1-5)' })
    @IsInt()
    @Min(1)
    @Max(5)
    foodRating: number;

    @ApiProperty({ example: 4, description: 'Rating for the delivery driver (1-5)' })
    @IsInt()
    @Min(1)
    @Max(5)
    deliveryRating: number;

    @ApiPropertyOptional({ example: 'Great food but slightly late delivery.' })
    @IsString()
    @IsOptional()
    comment?: string;
}
