export class SendEmailDto {
  to!: string;
  subject!: string;
  template!: string; // welcome, order_confirmation, order_delivered, refund_processed, onboarding_approved, etc.
  templateData!: Record<string, any>;
  event!: string;
  userId?: string;
  maxRetries?: number;
}
