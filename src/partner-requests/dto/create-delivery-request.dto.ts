import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional } from 'class-validator';

export class CreateDeliveryRequestDto {
    @ApiProperty({ example: 'Bike', description: 'Type of vehicle', enum: ['Bike', 'Scooter'] })
    @IsString()
    @IsIn(['Bike', 'Scooter'])
    vehicleType!: string;

    @ApiProperty({ example: 'DL1234567890', description: 'Driving license number' })
    @IsString()
    licenseNumber!: string;

    @ApiProperty({ example: 'DL01AB1234', description: 'Vehicle registration plate number' })
    @IsString()
    vehiclePlate!: string;

    @ApiPropertyOptional({ example: 'https://cloudinary.com/front.jpg' })
    @IsOptional()
    @IsString()
    licenseFrontUrl?: string;

    @ApiPropertyOptional({ example: 'https://cloudinary.com/back.jpg' })
    @IsOptional()
    @IsString()
    licenseBackUrl?: string;

    @ApiPropertyOptional({ example: 'https://cloudinary.com/rc.jpg' })
    @IsOptional()
    @IsString()
    vehicleRcUrl?: string;

    @ApiPropertyOptional({ example: 'https://cloudinary.com/profile.jpg' })
    @IsOptional()
    @IsString()
    profilePicUrl?: string;

    @ApiPropertyOptional({ example: '+1234567890' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ example: 'driver@example.com' })
    @IsOptional()
    @IsString()
    email?: string;
}
