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
const EMAIL_TEMPLATES: Record<string, (data: any) => string> = {
  welcome: (data) => `
    <h2>Welcome to ${data.appName || 'FoodApp'}!</h2>
    <p>Hi ${data.userName},</p>
    <p>Thank you for signing up. Your account is ready to use.</p>
    <p>Download our app and explore restaurants near you!</p>
  `,

  order_confirmation: (data) => `
    <h2>Order Confirmed!</h2>
    <p>Hi ${data.userName},</p>
    <p>Your order #${data.orderId} has been confirmed.</p>
    <p><strong>Total: ₹${data.totalAmount}</strong></p>
    <p>Restaurant: ${data.restaurantName}</p>
    <p>Estimated delivery: ${data.estimatedDeliveryTime || '30 mins'}</p>
  `,

  order_delivered: (data) => `
    <h2>Order Delivered!</h2>
    <p>Hi ${data.userName},</p>
    <p>Your order #${data.orderId} has been delivered.</p>
    <p>Restaurant: ${data.restaurantName}</p>
    <p>We'd love to hear your feedback!</p>
  `,

  refund_processed: (data) => `
    <h2>Refund Processed</h2>
    <p>Hi ${data.userName},</p>
    <p>Your refund of ₹${data.refundAmount} has been processed.</p>
    <p>Order: #${data.orderId}</p>
    <p>Reason: ${data.reason}</p>
  `,

  onboarding_approved: (data) => `
    <h2>Welcome to the FoodApp Team!</h2>
    <p>Hi ${data.partnerName},</p>
    <p>Your ${data.partnerType} onboarding has been approved.</p>
    <p>You can now start ${data.partnerType === 'restaurant' ? 'accepting orders' : 'delivering orders'}.</p>
    <p>Log in to your dashboard to get started.</p>
  `,
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

      this.logger.log(`Email sent successfully. Log ID: ${communicationLogId}`);
      return { success: true, providerMessageId };
    } catch (error) {
      this.logger.error(`Email send failed: ${error}. Attempt ${job.attemptsMade + 1}`);

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
