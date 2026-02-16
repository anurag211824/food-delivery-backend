import { IsEmail, IsString, IsOptional, IsBoolean, IsUrl, MinLength, IsIn } from 'class-validator';

export class SignUpDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password!: string;

    @IsString()
    name!: string;

    @IsOptional()
    @IsUrl()
    image?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    dob?: string;

    @IsOptional()
    @IsString()
    gender?: string;

    @IsOptional()
    @IsBoolean()
    isVeg?: boolean;

    @IsOptional()
    @IsString()
    language?: string;
}

export class SignInDto {
    @IsEmail()
    email!: string;

    @IsString()
    password!: string;
}

export class SocialSignInDto {
    @IsIn(['google'])
    provider!: 'google';

    @IsOptional()
    @IsString()
    callbackURL?: string;
}