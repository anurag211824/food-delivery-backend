import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client'; // strictly typed from Prisma

@Controller('api/test')
export class TestController {

  // 1. 🌍 PUBLIC: Anyone can access
  @Get('public')
  getPublic() {
    return { message: "I am public. Anyone can see me!" };
  }

  // 2. 🔒 PROTECTED: Only logged-in users (Any Role)
  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected(@Req() req: any) {
    return { 
      message: "You are logged in!", 
      user: req.user,       // The Guard attached this
      session: req.session  // The Guard attached this
    };
  }

  // 3. 🛡️ ADMIN ONLY: Only users with role 'ADMIN'
  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAdminOnly(@Req() req: any) {
    return { 
      message: "Welcome, Admin!", 
      secretData: "Only admins see this." 
    };
  }

  // 4. 🛵 RIDER ONLY: Only users with role 'DELIVERY_PARTNER'
  @Get('rider')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.DELIVERY_PARTNER)
  getRiderOnly() {
    return { message: "Ride safe! Here are your orders." };
  }
}