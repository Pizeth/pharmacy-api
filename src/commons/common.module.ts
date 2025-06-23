import { Module } from '@nestjs/common';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { TokenService } from './services/token.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VirusScanService } from './services/virus-scan.service';
import { LoggerService } from './services/logger.service';
import { HttpModule } from '@nestjs/axios';
// import { ObjectOmitter } from './services/object-utils.service';
import { ExceptionService } from './services/exception.service';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from 'src/filters/http-exception.filter';
import { TransformInterceptor } from 'src/interceptors/transform.interceptor';
import { QrCodeServicce } from 'src/commons/configs/qr-code.service';
import { FileModule } from 'src/modules/files/file.module';

@Module({
  imports: [
    // HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRET_KEY'), // Or a default for seeding
        signOptions: { expiresIn: config.get('EXPIRES_IN') }, // Or a default
      }),
    }),
    FileModule, // Assuming FileModule is defined elsewhere
  ],
  providers: [
    PasswordUtils,
    TokenService,
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
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [
    PasswordUtils,
    TokenService,
    // VirusScanService,
    // ObjectOmitter,
    ExceptionService,
    LoggerService,
    QrCodeServicce,
    // HttpModule,
  ],
})
export class CommonModule {}
