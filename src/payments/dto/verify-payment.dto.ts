import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyPaymentDto {
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

    @ApiProperty({ description: 'Internal Order ID' })
    @IsString()
    @IsNotEmpty()
    orderId: string;
}
