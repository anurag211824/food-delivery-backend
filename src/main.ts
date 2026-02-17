import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. CORS Configuration
  app.enableCors({
    origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // 2. Global Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
  app.use(morgan('dev'));

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  console.log(`🚀 Server running on: http://localhost:${port}`);
  console.log(`📜 API Contract available at: http://localhost:${port}/api/docs`);
}
bootstrap();