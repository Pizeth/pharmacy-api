// **CRITICAL STEP**: The import of the patch file MUST be the very first line.
// import './zod-patch'; // <-- This executes the patch immediately.
import * as dotenv from 'dotenv';
dotenv.config(); // 👈 MUST be line 1 before importing any services/auth modules!
import { NestFactory } from '@nestjs/core';
import { HotModule } from './types/types';
import { CorrelationMiddleware } from './middlewares/correlation.middleware';
import 'reflect-metadata';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
// import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

declare const module: HotModule;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth
  });
  // app.setGlobalPrefix('v1');
  // Set a global prefix for all routes (e.g., /api)
  app.setGlobalPrefix('api', {
    exclude: [
      // { path: '/', method: RequestMethod.GET }, // 👈 FIXED: Explicitly bypass ONLY the root GET request
      // '/',
      // '/auth',
      { path: 'images', method: RequestMethod.GET },
      { path: 'images/*path', method: RequestMethod.GET }, // 👈 catches all sub-routes
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ], // 👈 exclude from prefix
  });

  // Enable URI versioning with a default version "3"
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // 👈 This automatically injects /v1 after /api
  });

  // 🛡️ Direct Express interceptor for the absolute root domain
  app.getHttpAdapter().get('/', (req: Request, res: Response) => {
    res.status(200).json({
      name: 'Welcome to PISETHCHESDA Pharmacy API Gateway',
      message:
        'Please use /api to view gateway status, or /api/v1/{resource} to access endpoints.',
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
      description:
        'Core RESTful API engine managing inventory, points of sale (POS), and automated localized asset assets.',
      documentation: {
        swaggerUi: '/api-docs',
        openapiJson: '/api-docs-json',
      },
      routingRules: {
        prefix: '/api',
        versioningStrategy: 'URI Path (e.g., /api/v1/)',
      },
      primaryEndpoints: {
        authConfig: '/auth-config',
        images: {
          base: '/images',
          exampleSvg: '/images/adventurer?seed=Chesda',
          examplePng: '/images/initials/png?seed=Piseth&backgroundColor=e53935',
        },
        health: {
          live: '/health/live',
          ready: '/health/ready',
        },
      },
      support: {
        environment: process.env.NODE_ENV || 'development',
        contact: 'developer-support@razeth.com',
      },
    });
  });

  const correlationMiddleware = new CorrelationMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
      .split(',')
      .map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-captcha-response'],
    exposedHeaders: [
      'set-auth-token', // 👈 expose Bearer token header
      'set-auth-jwt', // 👈 expose JWT header (used by getSession)
    ],
    credentials: true, // ⚠️ CRITICAL: Must be true so Better Auth cookies can be sent across domains!
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
