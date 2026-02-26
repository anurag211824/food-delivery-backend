import { Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

@Module({
    controllers: [AppConfigController],
    providers: [AppConfigService],
    exports: [AppConfigService],  // exported so ReferralsModule can use it
})
export class AppConfigModule { }
