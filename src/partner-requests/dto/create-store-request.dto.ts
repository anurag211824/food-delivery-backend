import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateStoreRequestDto {
    @ApiProperty({ example: "Instamart Dark Store 1", description: 'Proposed store name' })
    @IsString()
    storeName!: string;

    @ApiPropertyOptional({ example: 'Local dark store for express grocery delivery', description: 'Short description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'Sector 62, Noida, UP – 201301', description: 'Physical address of the dark store' })
    @IsString()
    address!: string;

    @ApiProperty({ example: 28.628, description: 'Latitude of the store location' })
    @IsNumber()
    lat!: number;

    @ApiProperty({ example: 77.378, description: 'Longitude of the store location' })
    @IsNumber()
    lng!: number;

    @ApiPropertyOptional({ example: '09AAAAA1111A1Z1', description: 'GST number (optional)' })
    @IsOptional()
    @IsString()
    gstNumber?: string;

    @ApiPropertyOptional({ example: 'https://cloudinary.com/storelogo.png', description: 'Logo URL' })
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @ApiPropertyOptional({ example: 'https://cloudinary.com/storebanner.png', description: 'Banner URL' })
    @IsOptional()
    @IsString()
    bannerUrl?: string;
}
