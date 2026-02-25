import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class TopupWalletDto {
    @ApiProperty({ description: 'Amount to add to wallet', example: 500 })
    @IsNumber()
    @Min(1)
    amount: number;
}
