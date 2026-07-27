import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class ResolveWithdrawalDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' })
  @IsEnum(['APPROVED', 'REJECTED'])
  status: RequestStatus;

  @ApiPropertyOptional({ example: 'Invalid IFS code' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
