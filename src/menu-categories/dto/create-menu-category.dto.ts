import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMenuCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "Recommended", "Main Course", "Drinks"
}