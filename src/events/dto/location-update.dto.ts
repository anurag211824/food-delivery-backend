import { IsString, IsNotEmpty, IsNumber, IsOptional, IsLatitude, IsLongitude } from 'class-validator';

export class LocationUpdateDto {
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @IsString()
    @IsOptional()
    driverProfileId?: string;

    @IsNumber()
    @IsLatitude()
    lat: number;

    @IsNumber()
    @IsLongitude()
    lng: number;
}
