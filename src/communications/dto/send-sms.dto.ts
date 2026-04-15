export class SendSmsDto {
  to!: string; // Phone number in E.164 format: +919876543210
  message!: string;
  event!: string; // LOGIN_OTP, DELIVERY_OTP, etc.
  userId?: string;
  templateData?: Record<string, any>;
  maxRetries?: number;
}
