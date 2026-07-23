import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/pagination.dto';

export class ListRestaurantsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 12.9716,
    description: 'User latitude for geolocation filtering',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  userLat?: number;

  @ApiPropertyOptional({
    example: 77.5946,
    description: 'User longitude for geolocation filtering',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  userLng?: number;
}
