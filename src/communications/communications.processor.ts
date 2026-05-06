import { Injectable, Logger, Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import type { ISmsProvider } from './interfaces/sms-provider.interface';
import type { IEmailProvider } from './interfaces/email-provider.interface';
import { CommunicationStatus } from '@prisma/client';

/**
 * Email Templates
 * Simple template rendering. For more complex templates, use a library like Handlebars.
 */
/**
 * Professional Email Layout
 */
const getEmailLayout = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #FF4B2B 0%, #FF416C 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 30px; }
    .footer { background: #f4f4f4; padding: 20px; text-align: center; color: #777; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #FF416C; color: white; text-decoration: none; border-radius: 50px; font-weight: 600; margin-top: 20px; }
    .order-card { background: #fff5f6; border: 1px solid #ffebeb; padding: 20px; border-radius: 12px; margin: 20px 0; }
    .divider { height: 1px; background: #eeeeee; margin: 20px 0; }
    .text-primary { color: #FF416C; }
    .text-bold { font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FoodApp</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© 2026 FoodApp Delivery Service. All rights reserved.</p>
      <p>123 Food Street, Tasty City, IN 400001</p>
      <p>If you have any questions, contact our <a href="#" style="color: #FF416C; text-decoration: none;">Support Team</a></p>
    </div>
  </div>
</body>
</html>
`;

const EMAIL_TEMPLATES: Record<string, (data: any) => string> = {
  welcome: (data) => getEmailLayout(`
    <h2>Welcome to the family, ${data.userName}! 🍕</h2>
    <p>We're absolutely thrilled to have you here. Your journey to finding the most delicious food in town starts now.</p>
    <p>Our app allows you to explore hundreds of restaurants, track your delivery in real-time, and get exclusive discounts.</p>
    <a href="${data.appUrl || '#'}" class="button">Start Exploring</a>
    <p style="margin-top: 30px;">Happy eating!<br>The FoodApp Team</p>
  `, 'Welcome to FoodApp!'),

  order_confirmation: (data) => getEmailLayout(`
    <h2>Order Confirmed! ✅</h2>
    <p>Hi ${data.userName}, your appetite is in good hands. We've notified the restaurant and they are starting on your order.</p>
    <div class="order-card">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">ORDER SUMMARY</p>
      <h3 style="margin: 0; color: #333;">Order #${data.orderId.slice(-6).toUpperCase()}</h3>
      <p style="margin: 5px 0 0 0;"><strong>${data.restaurantName}</strong></p>
      <div class="divider"></div>
      <p style="margin: 0; display: flex; justify-content: space-between;">
        <span>Amount Paid:</span>
        <span class="text-bold text-primary">₹${data.totalAmount}</span>
      </p>
    </div>
    <p>Estimated arrival in <span class="text-bold">${data.estimatedDeliveryTime || '30-40 mins'}</span>.</p>
    <a href="${data.trackingUrl || '#'}" class="button">Track Your Order</a>
  `, 'Order Confirmed!'),

  order_delivered: (data) => getEmailLayout(`
    <h2>Enjoy your meal! 😋</h2>
    <p>Hi ${data.userName}, your order from <strong>${data.restaurantName}</strong> has been delivered. We hope you love it!</p>
    
    <div class="order-card">
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Order Summary - #${data.orderId.slice(-6).toUpperCase()}</p>
      
      <table style="width: 100%; border-collapse: collapse;">
        ${(data.items || []).map((item: any) => `
          <tr>
            <td style="padding: 8px 0;">${item.name} <span style="color: #888;">× ${item.quantity}</span></td>
            <td style="padding: 8px 0; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="divider"></div>
      
      <table style="width: 100%; font-size: 14px; color: #555;">
        <tr>
          <td style="padding: 4px 0;">Item Total</td>
          <td style="padding: 4px 0; text-align: right;">₹${data.itemTotal?.toFixed(2)}</td>
        </tr>
        ${data.deliveryCharge ? `
        <tr>
          <td style="padding: 4px 0;">Delivery Fee</td>
          <td style="padding: 4px 0; text-align: right;">₹${data.deliveryCharge.toFixed(2)}</td>
        </tr>` : ''}
        ${data.tax ? `
        <tr>
          <td style="padding: 4px 0;">Taxes</td>
          <td style="padding: 4px 0; text-align: right;">₹${data.tax.toFixed(2)}</td>
        </tr>` : ''}
        ${data.platformFee ? `
        <tr>
          <td style="padding: 4px 0;">Platform Fee</td>
          <td style="padding: 4px 0; text-align: right;">₹${data.platformFee.toFixed(2)}</td>
        </tr>` : ''}
        ${data.driverTip ? `
        <tr>
          <td style="padding: 4px 0;">Rider Tip</td>
          <td style="padding: 4px 0; text-align: right;">₹${data.driverTip.toFixed(2)}</td>
        </tr>` : ''}
        ${data.discount ? `
        <tr>
          <td style="padding: 4px 0; color: #4CAF50;">Discount</td>
          <td style="padding: 4px 0; text-align: right; color: #4CAF50;">-₹${data.discount.toFixed(2)}</td>
        </tr>` : ''}
        <tr style="font-size: 18px; color: #333; font-weight: 700;">
          <td style="padding: 15px 0 0 0;">Total Paid</td>
          <td style="padding: 15px 0 0 0; text-align: right; color: #FF416C;">₹${data.totalAmount?.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="order-card" style="text-align: center; background: #fff;">
      <p style="margin-bottom: 15px;">How was the food and delivery?</p>
      <div style="font-size: 24px; margin-bottom: 20px;">⭐⭐⭐⭐⭐</div>
      <a href="${data.reviewUrl || '#'}" style="color: #FF416C; font-weight: 600; text-decoration: none;">Tap here to leave a review</a>
    </div>
    
    <p style="font-size: 13px; color: #999; text-align: center;">If you didn't receive your order or had any issues, please let us know immediately.</p>
  `, 'Order Delivered!'),

  refund_processed: (data) => getEmailLayout(`
    <h2>Refund Processed 💰</h2>
    <p>Hi ${data.userName}, your refund for order <strong>#${data.orderId.slice(-6).toUpperCase()}</strong> has been processed successfully.</p>
    <div class="order-card">
      <p style="margin: 0;">Refund Amount: <span class="text-bold text-primary">₹${data.refundAmount}</span></p>
      <p style="margin: 5px 0 0 0;">Reason: ${data.reason}</p>
    </div>
    <p>The amount should reflect in your source account within 5-7 business days depending on your bank.</p>
  `, 'Refund Processed'),

  onboarding_approved: (data) => getEmailLayout(`
    <h2>You're Approved! 🎉</h2>
    <p>Hi ${data.partnerName}, welcome to the team! Your registration as a <strong>${data.partnerType} partner</strong> has been reviewed and approved.</p>
    <p>You can now log in to the FoodApp Partner app and start growing your business.</p>
    <div class="order-card">
      <p style="margin: 0;"><strong>Step 1:</strong> Log in to the app</p>
      <p style="margin: 5px 0 0 0;"><strong>Step 2:</strong> Complete your profile</p>
      <p style="margin: 5px 0 0 0;"><strong>Step 3:</strong> Start accepting orders!</p>
    </div>
    <a href="${data.loginUrl || '#'}" class="button">Partner Dashboard</a>
  `, 'Onboarding Approved'),
};

@Processor('communications')
@Injectable()
export class CommunicationsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommunicationsProcessor.name);

  constructor(
    private prisma: PrismaService,
    @Inject('ISmsProvider') private smsProvider: ISmsProvider,
    @Inject('IEmailProvider') private emailProvider: IEmailProvider,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-sms') {
      return this.processSmsSend(job);
    } else if (job.name === 'send-email') {
      return this.processEmailSend(job);
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async processSmsSend(job: Job<any>) {
    const { communicationLogId, to, message } = job.data;

    try {
      this.logger.debug(`Processing SMS job. Log ID: ${communicationLogId}`);

      // Send SMS via provider
      const providerMessageId = await this.smsProvider.send(to, message);

      // Update log as sent
      await this.prisma.communicationLog.update({
        where: { id: communicationLogId },
        data: {
          status: CommunicationStatus.SENT,
          providerName: this.smsProvider.name,
          providerMessageId,
          sentAt: new Date(),
          attempts: job.attemptsMade + 1,
        },
      });

      this.logger.log(`SMS sent successfully. Log ID: ${communicationLogId}`);
      return { success: true, providerMessageId };
    } catch (error) {
      this.logger.error(`SMS send failed: ${error}. Attempt ${job.attemptsMade + 1}`);

      // Update log with error
      await this.prisma.communicationLog.update({
        where: { id: communicationLogId },
        data: {
          status: job.attemptsMade + 1 >= 3 ? CommunicationStatus.FAILED : CommunicationStatus.PENDING,
          error: error instanceof Error ? error.message : String(error),
          attempts: job.attemptsMade + 1,
        },
      });

      // Re-throw to trigger retry
      throw error;
    }
  }

  private async processEmailSend(job: Job<any>) {
    const { communicationLogId, to, subject, template, templateData } = job.data;

    try {
      this.logger.debug(`Processing email job. Log ID: ${communicationLogId}`);

      // Render template
      const templateRenderer = EMAIL_TEMPLATES[template];
      if (!templateRenderer) {
        throw new Error(`Unknown email template: ${template}`);
      }

      const html = templateRenderer(templateData);
      this.logger.log(`📧 Sending ${template} email to ${to}...`);

      // Send email via provider
      const providerMessageId = await this.emailProvider.send(to, subject, html);

      // Update log as sent
      await this.prisma.communicationLog.update({
        where: { id: communicationLogId },
        data: {
          status: CommunicationStatus.SENT,
          providerName: this.emailProvider.name,
          providerMessageId,
          sentAt: new Date(),
          attempts: job.attemptsMade + 1,
        },
      });

      this.logger.log(`✨ Email job completed successfully. [Log ID: ${communicationLogId}]`);
      return { success: true, providerMessageId };
    } catch (error) {
      this.logger.error(`🚨 Email job failed for ${to}: ${error}. Attempt ${job.attemptsMade + 1}/3`);

      // Update log with error
      await this.prisma.communicationLog.update({
        where: { id: communicationLogId },
        data: {
          status: job.attemptsMade + 1 >= 3 ? CommunicationStatus.FAILED : CommunicationStatus.PENDING,
          error: error instanceof Error ? error.message : String(error),
          attempts: job.attemptsMade + 1,
        },
      });

      // Re-throw to trigger retry
      throw error;
    }
  }
}
