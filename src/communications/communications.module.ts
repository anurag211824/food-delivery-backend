import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CommunicationsService } from './communications.service';
import { CommunicationsProcessor } from './communications.processor';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { ExotelSmsProvider } from './providers/exotel-sms.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

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
      useClass: ResendEmailProvider,
    },
    // Re-export for injection via the interface key
    MockSmsProvider,
    ExotelSmsProvider,
    {
      provide: ResendEmailProvider,
      useClass: ResendEmailProvider,
    },
  ],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
