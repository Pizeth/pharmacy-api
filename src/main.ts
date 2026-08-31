// **CRITICAL STEP**: The import of the patch file MUST be the very first line.
// import './zod-patch'; // <-- This executes the patch immediately.
// import * as dotenv from 'dotenv';
// dotenv.config(); // 👈 MUST be line 1 before importing any services/auth modules!

/**
 * Must execute before application modules that may read process.env
 * during module initialization.
 */
import 'dotenv/config';
import 'reflect-metadata';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppModule } from './app.module';
import { CorrelationMiddleware } from './middlewares/correlation.middleware';
// import { HotModule } from './types/types';

// import { ZodValidationPipe } from 'nestjs-zod';

// import { StandardSchemaValidationPipe } from '@nestjs/common';

// declare const module: HotModule;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    /**
     * Required by the Better Auth Nest integration.
     *
     * That integration re-registers body parsing for the normal
     * non-auth routes.
     */
    bodyParser: false,
  });

  // app.setGlobalPrefix('v1');
  // Set a global prefix for all routes (e.g., /api)
  /**
   * --------------------------------------------------------------
   * Global API prefix
   * --------------------------------------------------------------
   */
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

  /**
   * --------------------------------------------------------------
   * URI API versioning
   * --------------------------------------------------------------
   *
   * Produces routes such as:
   *
   *   /api/v1/...
   */
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // 👈 This automatically injects /v1 after /api
  });

  /**
   * --------------------------------------------------------------
   * Absolute application root
   * --------------------------------------------------------------
   *
   * 🛡️ Direct Express interceptor for the absolute root domain
   * Registered directly on the Express adapter so this endpoint is
   * independent from the global /api prefix and API versioning.
   */
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

  /**
   * --------------------------------------------------------------
   * Correlation middleware
   * --------------------------------------------------------------
   */
  const correlationMiddleware = new CorrelationMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));

  /**
   * --------------------------------------------------------------
   * CORS
   * --------------------------------------------------------------
   */
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
      .split(',')
      .map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-captcha-response'],
    exposedHeaders: [
      'set-auth-token', // 👈 expose Bearer token header
      'set-auth-jwt', // 👈 expose JWT header (used by getSession)
      'Authorization',
    ],

    /**
     * Required for Better Auth cookies across origins.
     */
    credentials: true, // ⚠️ CRITICAL: Must be true so Better Auth cookies can be sent across domains!
  });

  // 1. Use the global ZodValidationPipe from `nestjs-zod`
  // app.useGlobalPipes(new ZodValidationPipe());

  /**
   * --------------------------------------------------------------
   * OpenAPI
   * --------------------------------------------------------------
   *
   * NestJS 12 + Swagger 12 automatically understands Standard Schema
   * libraries exposing ~standard.jsonSchema.
   *
   * Zod 4 does this natively, so no custom standardSchemaConverter
   * is needed.
   */
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pharmacy API')
    .setDescription('API documentation for Chesda Pharmacy app')
    .setVersion('1.0')
    .addTag('pharmacy')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  // const documentFactory = () =>
  //   SwaggerModule.createDocument(app, swaggerConfig, swaggerDocumentOptions);

  // Serve static OpenAPI JSON
  // app.use(
  //   '/api-docs/json',
  //   swaggerUi.serveFiles(openApiSpec),
  //   swaggerUi.setup(openApiSpec),
  // );

  /**
   * NestJS 12 schema-first request validation.
   */
  // app.useGlobalPipes(
  //   new StandardSchemaValidationPipe({
  //     transform: true,
  //   }),
  // );

  /**
   * --------------------------------------------------------------
   * Start server
   * --------------------------------------------------------------
   */
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);

  /**
   * --------------------------------------------------------------
   * Existing webpack HMR
   * --------------------------------------------------------------
   *
   * Keep this temporarily while the Nest 12 framework upgrade and
   * bundler migration remain separate changes.
   */
  // if (module.hot) {
  //   module.hot.accept();
  //   module.hot.dispose(() => app.close());
  // }
}
bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
