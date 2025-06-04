import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HotModule } from './types/types';
import { CorrelationMiddleware } from './middlewares/correlation.middleware';

declare const module: HotModule;
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  const correlationMiddleware = new CorrelationMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8080').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
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
