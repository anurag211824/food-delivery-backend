import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhitelistThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;

    // 🚀 INDUSTRY STANDARD WHITELIST
    // This reads from your .env file (or Render Environment Variables)
    // Format: WHITELISTED_IPS=1.1.1.1,2.2.2.2
    const configService = new ConfigService(); // Or inject via constructor if preferred
    const whitelistEnv = process.env.WHITELISTED_IPS || '';
    const whitelistedIps = [
      ...whitelistEnv.split(',').map(item => item.trim()),
      '127.0.0.1', 
      '::1'
    ];
    
    if (whitelistedIps.includes(ip)) {
      return true;
    }

    return false;
  }
}
