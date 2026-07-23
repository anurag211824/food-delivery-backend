import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({
    example: 'clxyz123',
    description: 'The ID of the user whose role you want to change',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    enum: Role,
    example: Role.RESTAURANT_MANAGER,
    description: 'The new role to assign to the user',
  })
  @IsEnum(Role)
  role!: Role;
}
