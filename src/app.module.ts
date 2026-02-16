import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { TestController } from './test/test.controller';

@Module({
  imports: [AuthModule],
  controllers: [AppController, TestController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
