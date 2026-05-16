import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class WhitelistThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;

    // 🚀 WHITELIST LOGIC
    // Replace 'YOUR_IP_HERE' with your actual IP address.
    // Example: if (ip === '122.161.50.12') return true;
    const whitelistedIps = ['2405:201:6803:3262:4119:72e0:17f1:f13c', '127.0.0.1', '::1'];
    
    if (whitelistedIps.includes(ip)) {
      return true; // Skip throttling for these IPs
    }

    return false;
  }
}
