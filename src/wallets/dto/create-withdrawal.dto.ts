import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithdrawalDto {
  @ApiProperty({
    example: 500,
    description: 'Amount to withdraw (min ₹100, max ₹50,000)',
  })
  @IsNumber()
  @Min(100)
  @Max(50000)
  amount: number;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  bankAccountName: string;

  @ApiProperty({ example: '123456789012' })
  @IsString()
  @IsNotEmpty()
  bankAccountNumber: string;

  @ApiProperty({ example: 'HDFC0001234' })
  @IsString()
  @IsNotEmpty()
  ifscCode: string;
}
