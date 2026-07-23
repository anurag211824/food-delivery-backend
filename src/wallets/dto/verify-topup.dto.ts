import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyTopupDto {
  @ApiProperty({ description: 'Razorpay Payment ID' })
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @ApiProperty({ description: 'Razorpay Order ID' })
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @ApiProperty({ description: 'Razorpay Signature for verification' })
  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;
}
