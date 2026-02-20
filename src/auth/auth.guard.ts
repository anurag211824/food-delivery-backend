import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // --- Extract token from multiple sources ---
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    // --- Look up session directly in DB ---
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    // --- Reject if not found or expired ---
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // --- Attach user and session to request for use in controllers ---
    request['user'] = session.user;
    request['session'] = session;

    return true;
  }

  private extractToken(request: any): string | null {
    // 1. Bearer token from Authorization header (mobile apps / Postman)
    const authHeader: string | undefined = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    // 2. Cookie-based session (browsers / web clients)
    // better-auth sets the cookie as: better-auth.session_token
    const cookieHeader: string | undefined = request.headers['cookie'];
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c: string) => {
          const [key, ...val] = c.trim().split('=');
          return [key.trim(), val.join('=').trim()];
        }),
      );
      const cookieToken = cookies['better-auth.session_token'];
      if (cookieToken) return cookieToken;
    }

    return null;
  }
}