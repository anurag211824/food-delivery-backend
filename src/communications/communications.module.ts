import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CommunicationsService } from './communications.service';
import { CommunicationsProcessor } from './communications.processor';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { ExotelSmsProvider } from './providers/exotel-sms.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { MockEmailProvider } from './providers/mock-email.provider';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'communications',
    }),
    PrismaModule,
  ],
  providers: [
    CommunicationsService,
    CommunicationsProcessor,
    {
      provide: 'ISmsProvider',
      useFactory: (configService: ConfigService) => {
        const smsProvider = configService.get<string>('SMS_PROVIDER', 'mock').toLowerCase();
        
        if (smsProvider === 'exotel') {
          return new ExotelSmsProvider(configService);
        }
        // Default to mock for development
        return new MockSmsProvider();
      },
      inject: [ConfigService],
    },
    {
      provide: 'IEmailProvider',
      useFactory: (configService: ConfigService) => {
        const emailProvider = configService.get<string>('EMAIL_PROVIDER', 'mock').toLowerCase();
        
        if (emailProvider === 'resend' && configService.get('RESEND_API_KEY')) {
          return new ResendEmailProvider(configService);
        }
        // Default to mock for development
        return new MockEmailProvider();
      },
      inject: [ConfigService],
    },
    // Re-export for injection via the interface key
    MockSmsProvider,
    ExotelSmsProvider,
    MockEmailProvider,
    ResendEmailProvider,
  ],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
