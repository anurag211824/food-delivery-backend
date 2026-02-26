import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyReferralDto {
    @ApiProperty({ example: 'FRIEND50', description: 'The referral code of the user who invited you' })
    @IsString()
    @IsNotEmpty()
    referralCode: string;
}
