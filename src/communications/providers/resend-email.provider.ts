import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from '../interfaces/email-provider.interface';

/**
 * Resend Email Provider
 * 
 * API Reference: https://resend.com/docs/api-reference/emails/send
 * Pricing: 100/day, 3,000/month free tier
 * 
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Get API key from dashboard
 * 3. Add to env: RESEND_API_KEY, RESEND_FROM_EMAIL
 */
@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private apiKey: string;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    this.apiKey = configService.get<string>('RESEND_API_KEY', '');
    this.fromEmail = configService.get<string>('RESEND_FROM_EMAIL', 'noreply@foodapp.com');
  }

  async send(to: string, subject: string, html: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.error('Resend API key not configured');
      throw new Error('Resend email provider not configured');
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Resend email failed: ${error}`);
        throw new Error(`Resend API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const messageId = data?.id;

      this.logger.debug(`Email sent via Resend. Message ID: ${messageId}`);
      return messageId || 'resend-' + Date.now();
    } catch (error) {
      this.logger.error(`Resend email error: ${error}`);
      throw error;
    }
  }
}
