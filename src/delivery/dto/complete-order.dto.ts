import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteOrderDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
