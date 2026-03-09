import { Module } from '@nestjs/common';
import { PartnerRequestsController } from './partner-requests.controller';
import { PartnerRequestsService } from './partner-requests.service';

@Module({
    controllers: [PartnerRequestsController],
    providers: [PartnerRequestsService],
})
export class PartnerRequestsModule { }
