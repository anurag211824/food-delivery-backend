import { IsEmail, IsString, IsOptional, IsBoolean, IsUrl, MinLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignUpDto {
    @ApiProperty({ example: 'user@example.com', description: 'User email address' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'strongPassword123', description: 'User password (min 8 chars)', minLength: 8 })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password!: string;

    @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
    @IsString()
    name!: string;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Profile picture URL' })
    @IsOptional()
    @IsUrl()
    image?: string;

    @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: '1990-01-01', description: 'Date of Birth (YYYY-MM-DD)' })
    @IsOptional()
    @IsString()
    dob?: string;

    @ApiPropertyOptional({ example: 'Male', description: 'Gender' })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ example: true, description: 'Is the user vegetarian?' })
    @IsOptional()
    @IsBoolean()
    isVeg?: boolean;

    @ApiPropertyOptional({ example: 'en', description: 'Preferred language' })
    @IsOptional()
    @IsString()
    language?: string;
}

export class SignInDto {
    @ApiProperty({ example: 'user@example.com', description: 'User email address' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'strongPassword123', description: 'User password' })
    @IsString()
    password!: string;
}

export class SocialSignInDto {
    @ApiProperty({ example: 'google', description: 'Social provider name', enum: ['google'] })
    @IsIn(['google'])
    provider!: 'google';

    @ApiPropertyOptional({ example: '/dashboard', description: 'URL to redirect after successful login' })
    @IsOptional()
    @IsString()
    callbackURL?: string;
}