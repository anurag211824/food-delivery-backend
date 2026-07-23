import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateSavedPaymentDto {
  @ApiProperty({
    example: 'CARD',
    description: 'Type of payment method (CARD, UPI)',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    example: '**** 4242',
    description: 'Masked value to show to the user',
  })
  @IsString()
  @IsNotEmpty()
  displayValue: string;

  @ApiProperty({
    example: 'tok_visa123',
    description: 'Secure token from the payment gateway',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether this is the default payment method',
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
