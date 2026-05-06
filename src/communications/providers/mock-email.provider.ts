import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from '../interfaces/email-provider.interface';

/**
 * Mock Email Provider
 * 
 * Used for development and testing. Instead of sending a real email,
 * it just logs the email contents to the console.
 */
@Injectable()
export class MockEmailProvider implements IEmailProvider {
  name = 'mock-email';
  private readonly logger = new Logger(MockEmailProvider.name);

  async send(to: string, subject: string, html: string): Promise<string> {
    this.logger.log(`
================== MOCK EMAIL ==================
To: ${to}
Subject: ${subject}
Body (HTML): 
${html.trim()}
================================================`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const messageId = `mock-email-${Date.now()}`;
    return messageId;
  }
}
