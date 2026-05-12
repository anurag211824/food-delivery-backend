import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateAddressDto {
    @ApiPropertyOptional({
        example: 'HOME',
        description: 'The nickname/type for the address',
        enum: ['HOME', 'WORK', 'OTHER'],
    })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiPropertyOptional({ example: '15 Rajpur Road, Dehradun', description: 'Full street address' })
    @IsString()
    @IsOptional()
    addressLine?: string;

    @ApiPropertyOptional({ example: 'Opposite Silvercity Mall' })
    @IsString()
    @IsOptional()
    landmark?: string;

    @ApiPropertyOptional({ example: 30.3256, description: 'GPS Latitude' })
    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    lat?: number;

    @ApiPropertyOptional({ example: 78.0437, description: 'GPS Longitude' })
    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    lng?: number;

    @ApiPropertyOptional({ example: 'Rahul', required: false })
    @IsString()
    @IsOptional()
    receiverName?: string;

    @ApiPropertyOptional({ example: '9876543210', required: false })
    @IsString()
    @IsOptional()
    receiverPhone?: string;
}
