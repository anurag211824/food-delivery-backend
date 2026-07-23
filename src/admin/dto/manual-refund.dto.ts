import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualRefundDto {
  @ApiProperty({
    description: 'The ID of the order to issue a refund for',
    example: 'clxyz123',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'The refund amount to be returned to the customer wallet',
    example: 250.5,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiProperty({
    description:
      'The reason for the manual refund (e.g. food quality issue, wrong items)',
    example: 'Customer complained about cold food and late delivery.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
