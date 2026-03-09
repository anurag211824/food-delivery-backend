import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

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
}
