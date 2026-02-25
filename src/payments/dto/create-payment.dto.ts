import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePaymentDto {
    @ApiProperty({ example: 'clxyz123', description: 'The internal Order ID' })
    @IsString()
    @IsNotEmpty()
    orderId: string;
}
