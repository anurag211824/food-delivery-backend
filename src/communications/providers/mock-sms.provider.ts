import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

/**
 * Mock SMS Provider for Development
 * 
 * Logs SMS to console instead of sending real messages
 * Perfect for testing without external service setup
 * Useful for: OTP testing, integration testing, local development
 */
@Injectable()
export class MockSmsProvider implements ISmsProvider {
  name = 'mock';
  private readonly logger = new Logger(MockSmsProvider.name);

  async send(to: string, message: string): Promise<string> {
    // Generate fake but realistic message ID
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Console log with nice formatting
    console.log('\n');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║         📱 SMS (DEVELOPMENT MODE)         ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║ To:      ${to.padEnd(36)} ║`);
    console.log(`║ Message: ${message.padEnd(36)} ║`);
    console.log(`║ ID:      ${messageId.padEnd(36)} ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n');

    // Log to NestJS logger as well
    this.logger.log(`[DEV MODE] SMS queued for ${to}. Message ID: ${messageId}`);
    this.logger.log(`[DEV MODE] Content: "${message}"`);

    return messageId;
  }
}
