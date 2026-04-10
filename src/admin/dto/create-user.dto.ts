import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'Manager Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'manager@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'At least 8 characters' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.RESTAURANT_MANAGER })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
