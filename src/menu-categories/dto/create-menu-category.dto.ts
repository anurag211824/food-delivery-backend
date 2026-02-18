import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'Main Course', description: 'Name of the menu category' })
  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "Recommended", "Main Course", "Drinks"
}