import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

export class TopupWalletDto {
  @ApiProperty({
    description: 'Amount to add to wallet (max ₹10,000 per request)',
    example: 500,
  })
  @IsNumber()
  @Min(1)
  @Max(10000)
  amount: number;
}
