import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReferralPolicyDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable the entire referral program',
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: 100,
    description: 'Rs reward for the person who shared the code',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  referrerReward?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Rs welcome bonus for the new user who used the code',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  referredReward?: number;
}
