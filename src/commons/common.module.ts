import { Module } from '@nestjs/common';
// import { PasswordUtils } from 'src/commons/services/password-utils.service';
// import { TokenService } from './services/token.service';
import { LoggerService } from './services/logger.service';
import { ExceptionService } from './services/exception.service';
import { APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GlobalExceptionFilter } from 'src/filters/http-exception.filter';
import { TransformInterceptor } from 'src/interceptors/transform.interceptor';
import { QrCodeServicce } from 'src/commons/configs/qr-code.service';
import { FileModule } from 'src/modules/files/file.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { ImagesModule } from 'src/modules/images/image.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ValidationExceptionFilter } from 'src/filters/validation-exception.filter';

@Module({
  imports: [
    // HttpModule,
    FileModule,
    ImagesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.get('SECRET_KEY'), // Or a default for seeding
        signOptions: { expiresIn: config.get('EXPIRES_IN') }, // Or a default
      }),
    }),
  ],
  providers: [
    // PasswordUtils,
    // TokenService,
    // VirusScanService,
    // ObjectOmitter,
    ExceptionService,
    LoggerService,
    QrCodeServicce,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
  exports: [
    // PasswordUtils,
    // TokenService,
    // VirusScanService,
    // ObjectOmitter,
    ExceptionService,
    LoggerService,
    QrCodeServicce,
    FileModule,
    ImagesModule,
    JwtModule,
    // HttpModule,
  ],
})
export class CommonModule {}
