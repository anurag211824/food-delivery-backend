import 'reflect-metadata';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './redis/redis.io-adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,{logger: ['error', 'warn','log','debug']});

  // 1. CORS Configuration
  app.enableCors({
    origin: [process.env.CUSTOMER_APP_ORIGIN, "http://localhost:5173", process.env.RESTAURANT_APP_ORIGIN,process.env.RIDER_APP_ORIGIN],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  });

  // 2. Global Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Initialize Redis IoAdapter for WebSocket scaling
  const configService = app.get(ConfigService);
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // 3. Swagger Contract Definition
  const config = new DocumentBuilder()
    .setTitle('Food Delivery API')
    .setDescription('Core API contract for Customers, Restaurants, and Riders')
    .setVersion('1.0')
    .addTag('Account & Profile', 'User authentication, addresses, and profile management')
    .addTag('Discover & Order', 'Restaurant discovery, search, and browsing')
    .addTag('Menu Management', 'Categories and food items management')
    .addTag('Orders', 'Order lifecycle and tracking')
    .addBearerAuth()
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 4. Middleware & Startup
  app.use(helmet());
  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  console.log(`🚀 Server running on: http://localhost:${port}`);
  console.log(`📜 API Contract available at: http://localhost:${port}/api/docs`);
}
bootstrap();