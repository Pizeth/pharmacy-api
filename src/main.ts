// **CRITICAL STEP**: The import of the patch file MUST be the very first line.
// import './zod-patch'; // <-- This executes the patch immediately.

import { NestFactory } from '@nestjs/core';
import { HotModule } from './types/types';
import { CorrelationMiddleware } from './middlewares/correlation.middleware';
import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

declare const module: HotModule;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.setGlobalPrefix('v1');
  // Set a global prefix for all routes (e.g., /api)
  app.setGlobalPrefix('api');

  // Enable URI versioning with a default version "3"
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const correlationMiddleware = new CorrelationMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8080').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 1. Use the global ZodValidationPipe from `nestjs-zod`
  // app.useGlobalPipes(new ZodValidationPipe());

  // 2. Setup Swagger as usual
  const config = new DocumentBuilder()
    .setTitle('Pharmacy API')
    .setDescription('API documentation for Chesda Pharmacy app')
    .setVersion('1.0')
    .addTag('pharmacy')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Serve static OpenAPI JSON
  // app.use(
  //   '/api-docs/json',
  //   swaggerUi.serveFiles(openApiSpec),
  //   swaggerUi.setup(openApiSpec),
  // );

  // await app.listen(process.env.PORT ?? 3000);
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
