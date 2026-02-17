import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image?: string; // We'll handle file uploads later

  @IsNumber()
  @Min(0)
  costForTwo: number;

  @IsArray()
  @IsString({ each: true })
  cuisineTypes: string[]; // e.g. ["Italian", "Mexican"]

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsString()
  @IsOptional()
  fssaiCode?: string;

  @IsString()
  @IsOptional()
  gstNumber?: string;
}