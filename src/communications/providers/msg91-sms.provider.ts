import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

/**
 * MSG91 SMS Provider
 * 
 * API Reference: https://docs.msg91.com/
 * Uses the Flow API (v5) for sending transactional SMS.
 * 
 * Setup:
 * 1. Sign up at https://msg91.com
 * 2. Get your Authkey from Dashboard → Settings → Server-Side Integration
 * 3. Create an SMS template/flow in the MSG91 dashboard
 * 4. Register your Sender ID
 * 5. Complete DLT registration (mandatory for India)
 * 6. Add to .env: MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_OTP_TEMPLATE_ID
 * 
 * Two modes supported:
 * - OTP Mode: Uses MSG91's dedicated OTP API (auto-generates & manages OTP)
 * - Flow Mode: Uses the Flow API for custom transactional SMS
 */
@Injectable()
export class Msg91SmsProvider implements ISmsProvider {
  name = 'msg91';
  private readonly logger = new Logger(Msg91SmsProvider.name);
  private authKey: string;
  private senderId: string;
  private otpTemplateId: string;
  private smsTemplateId: string;

  constructor(private configService: ConfigService) {
    this.authKey = configService.get<string>('MSG91_AUTH_KEY', '');
    this.senderId = configService.get<string>('MSG91_SENDER_ID', '');
    this.otpTemplateId = configService.get<string>('MSG91_OTP_TEMPLATE_ID', '');
    this.smsTemplateId = configService.get<string>('MSG91_SMS_TEMPLATE_ID', '');
  }

  /**
   * Send an SMS via MSG91 Flow API
   * For OTP messages, it uses the dedicated OTP endpoint.
   * For other transactional SMS, it uses the Flow API.
   */
  async send(to: string, message: string): Promise<string> {
    if (!this.authKey) {
      this.logger.error('MSG91 authkey not configured');
      throw new Error('MSG91 SMS provider not configured. Set MSG91_AUTH_KEY in .env');
    }

    // Detect if this is an OTP message
    const isOtp = message.toLowerCase().includes('otp') || message.toLowerCase().includes('verification code');

    if (isOtp && this.otpTemplateId) {
      return this.sendOtp(to, message);
    }

    return this.sendViaSmsApi(to, message);
  }

  /**
   * Send OTP via MSG91's dedicated OTP API
   * This is the recommended way to send OTPs — MSG91 handles retries,
   * auto-resend via voice/email, and expiry automatically.
   */
  private async sendOtp(to: string, message: string): Promise<string> {
    try {
      // Extract the OTP code from the message
      const otpMatch = message.match(/\b(\d{4,6})\b/);
      const otp = otpMatch ? otpMatch[1] : undefined;

      const mobile = this.formatMobile(to);

      const url = `https://control.msg91.com/api/v5/otp`;

      const body: Record<string, any> = {
        template_id: this.otpTemplateId,
        mobile: mobile,
      };

      // If we have a specific OTP code, pass it (otherwise MSG91 auto-generates one)
      if (otp) {
        body.otp = otp;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authkey': this.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok || data.type === 'error') {
        this.logger.error(`MSG91 OTP failed: ${JSON.stringify(data)}`);
        throw new Error(`MSG91 OTP error: ${data.message || response.status}`);
      }

      const messageId = data.request_id || `msg91-otp-${Date.now()}`;
      this.logger.debug(`OTP sent via MSG91 to ${mobile}. Request ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`MSG91 OTP error: ${error}`);
      throw error;
    }
  }

  /**
   * Send transactional SMS via MSG91 Flow API
   * Used for non-OTP messages like order updates, delivery alerts, etc.
   */
  private async sendViaSmsApi(to: string, message: string): Promise<string> {
    try {
      const mobile = this.formatMobile(to);
      const templateId = this.smsTemplateId;

      if (!templateId) {
        this.logger.error('MSG91_SMS_TEMPLATE_ID not configured for transactional SMS');
        throw new Error('MSG91 SMS template ID not configured. Set MSG91_SMS_TEMPLATE_ID in .env');
      }

      const url = 'https://control.msg91.com/api/v5/flow/';

      const body: Record<string, any> = {
        template_id: templateId,
        sender: this.senderId,
        short_url: '0',
        mobiles: mobile,
        // MSG91 uses template variables like VAR1, VAR2
        // We pass the entire message as VAR1 for flexibility
        VAR1: message,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authkey': this.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok || data.type === 'error') {
        this.logger.error(`MSG91 SMS failed: ${JSON.stringify(data)}`);
        throw new Error(`MSG91 Flow API error: ${data.message || response.status}`);
      }

      const messageId = data.request_id || `msg91-sms-${Date.now()}`;
      this.logger.debug(`SMS sent via MSG91 Flow to ${mobile}. Request ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`MSG91 Flow SMS error: ${error}`);
      throw error;
    }
  }

  /**
   * Format phone number to MSG91's expected format
   * MSG91 expects: country code + number WITHOUT the '+' sign
   * Example: +919876543210 → 919876543210
   */
  private formatMobile(phone: string): string {
    // Remove +, spaces, dashes
    let formatted = phone.replace(/[\s\-\+\(\)]/g, '');

    // If it starts with 0, remove the leading 0 and prepend 91 (India)
    if (formatted.startsWith('0')) {
      formatted = '91' + formatted.slice(1);
    }

    // If it's a 10-digit Indian number, prepend 91
    if (formatted.length === 10 && /^[6-9]/.test(formatted)) {
      formatted = '91' + formatted;
    }

    return formatted;
  }
}
