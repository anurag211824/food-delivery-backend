import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Use the Role enum from your Prisma schema

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);