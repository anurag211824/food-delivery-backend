import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

/**
 * Exotel SMS Provider
 * 
 * API Reference: https://developer.exotel.com/api-reference/#send-sms
 * Pricing: Trial account with ₹500 credits
 * Authentication: HTTP Basic Auth (apiKey:apiToken)
 * 
 * Setup:
 * 1. Sign up at https://exotel.com
 * 2. Get API key, API token, and SID from dashboard
 * 3. Add to env: EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID, EXOTEL_SUBDOMAIN, EXOTEL_FROM_NUMBER
 */
@Injectable()
export class ExotelSmsProvider implements ISmsProvider {
  name = 'exotel';
  private readonly logger = new Logger(ExotelSmsProvider.name);
  private apiKey: string;
  private apiToken: string;
  private sid: string;
  private subdomain: string;
  private fromNumber: string;
  private dltEntityId: string;
  private dltTemplateId: string;

  constructor(private configService: ConfigService) {
    this.apiKey = configService.get<string>('EXOTEL_API_KEY', '');
    this.apiToken = configService.get<string>('EXOTEL_API_TOKEN', '');
    this.sid = configService.get<string>('EXOTEL_SID', '');
    this.subdomain = configService.get<string>('EXOTEL_SUBDOMAIN', '@api.in.exotel.com');
    this.fromNumber = configService.get<string>('EXOTEL_FROM_NUMBER', 'FoodApp');
    this.dltEntityId = configService.get<string>('EXOTEL_DLT_ENTITY_ID', '');
    this.dltTemplateId = configService.get<string>('EXOTEL_DLT_TEMPLATE_ID', '');
  }

  async send(to: string, message: string): Promise<string> {
    if (!this.apiKey || !this.apiToken || !this.sid) {
      this.logger.error('Exotel credentials not configured');
      throw new Error('Exotel SMS provider not configured');
    }

    try {
      // Build Basic Auth: base64(apiKey:apiToken)
      const credentials = `${this.apiKey}:${this.apiToken}`;
      const encodedCredentials = Buffer.from(credentials).toString('base64');
      
      // Build the API URL
      const url = `https://api.exotel.com/v1/Accounts/${this.sid}/SMS/send.json`;
      
      // Build request body with DLT parameters for India compliance
      const bodyParams = {
        From: this.fromNumber,
        To: to,
        Body: message,
      } as Record<string, string>;
      
      // Add DLT parameters if configured (mandatory for India)
      if (this.dltEntityId) {
        bodyParams.DltEntityId = this.dltEntityId;
      }
      if (this.dltTemplateId) {
        bodyParams.DltTemplateId = this.dltTemplateId;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Exotel SMS failed: ${error}`);
        throw new Error(`Exotel API error: ${response.status}`);
      }

      const data = await response.json() as any;
      // Exotel returns response in format: { SMSMessage: { Sid: "...", ... }}
      const messageId = data?.SMSMessage?.Sid;
      
      if (!messageId) {
        this.logger.error(`No message ID received from Exotel: ${JSON.stringify(data)}`);
        throw new Error('No message ID received from Exotel');
      }
      
      this.logger.debug(`SMS sent via Exotel. Message ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Exotel SMS error: ${error}`);
      throw error;
    }
  }
}
