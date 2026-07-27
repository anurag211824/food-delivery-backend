import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ISmsProvider } from './interfaces/sms-provider.interface';
import type { IEmailProvider } from './interfaces/email-provider.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SendSmsDto } from './dto/send-sms.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CommunicationChannel, CommunicationStatus } from '@prisma/client';

/**
 * Communications Service
 *
 * Orchestrates SMS and Email delivery through queued jobs.
 * Uses BullMQ for reliable job processing with retries.
 */
@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('ISmsProvider') private smsProvider: ISmsProvider,
    @Inject('IEmailProvider') private emailProvider: IEmailProvider,
    @InjectQueue('communications') private communicationsQueue: Queue,
  ) {}

  /**
   * Queue an SMS for delivery
   */
  async queueSms(dto: SendSmsDto): Promise<string> {
    // Log to database
    const log = await this.prisma.communicationLog.create({
      data: {
        channel: CommunicationChannel.SMS,
        to: dto.to,
        event: dto.event,
        userId: dto.userId,
        templateData: dto.templateData,
        status: CommunicationStatus.PENDING,
        maxAttempts: dto.maxRetries || 3,
      },
    });

    // Queue the job
    await this.communicationsQueue.add(
      'send-sms',
      {
        communicationLogId: log.id,
        to: dto.to,
        message: dto.message,
      },
      {
        attempts: dto.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    );

    this.logger.debug(`SMS queued for ${dto.to}. Log ID: ${log.id}`);
    return log.id;
  }

  /**
   * Queue an Email for delivery
   */
  async queueEmail(dto: SendEmailDto): Promise<string> {
    // Log to database
    const log = await this.prisma.communicationLog.create({
      data: {
        channel: CommunicationChannel.EMAIL,
        to: dto.to,
        event: dto.event,
        subject: dto.subject,
        template: dto.template,
        templateData: dto.templateData,
        userId: dto.userId,
        status: CommunicationStatus.PENDING,
        maxAttempts: dto.maxRetries || 3,
      },
    });

    // Queue the job (consumer will render template and send)
    await this.communicationsQueue.add(
      'send-email',
      {
        communicationLogId: log.id,
        to: dto.to,
        subject: dto.subject,
        template: dto.template,
        templateData: dto.templateData,
      },
      {
        attempts: dto.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    );

    this.logger.debug(`Email queued for ${dto.to}. Log ID: ${log.id}`);
    return log.id;
  }

  /**
   * Get SMS provider (for direct access if needed)
   */
  getSmsProvider(): ISmsProvider {
    return this.smsProvider;
  }

  /**
   * Get Email provider (for direct access if needed)
   */
  getEmailProvider(): IEmailProvider {
    return this.emailProvider;
  }
}
