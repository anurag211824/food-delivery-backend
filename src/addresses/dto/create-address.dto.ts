import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ 
    example: 'HOME', 
    description: 'The nickname/type for the address',
    enum: ['HOME', 'WORK', 'OTHER'] 
  })
  @IsString()
  @IsNotEmpty()
  type: string; // [cite: 63, 68]

  @ApiProperty({ example: '15 Rajpur Road, Dehradun', description: 'Full street address' })
  @IsString()
  @IsNotEmpty()
  addressLine: string; // [cite: 63]

  @ApiProperty({ example: 'Opposite Silvercity Mall', required: false })
  @IsString()
  @IsOptional()
  landmark?: string; // [cite: 64]

  @ApiProperty({ example: 30.3256, description: 'GPS Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number; // [cite: 63]

  @ApiProperty({ example: 78.0437, description: 'GPS Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number; // [cite: 63]
}