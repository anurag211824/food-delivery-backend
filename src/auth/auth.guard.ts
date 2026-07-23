import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { auth } from '../lib/auth'; // Import your auth instance
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Convert Express headers to a format Better Auth understands
    const headers = fromNodeHeaders(request.headers);

    // 2. Fetch the session from the database/cookie
    const session = await auth.api.getSession({
      headers,
    });

    // 3. Strict Check: If no session, block access
    if (!session) {
      throw new UnauthorizedException('Please log in to access this resource');
    }

    // 4. Attach session and user to the request strictly
    // This allows you to access req.user and req.session in controllers
    request['user'] = session.user;
    request['session'] = session.session;

    return true;
  }
}
