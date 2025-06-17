import { Module } from '@nestjs/common';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { TokenService } from './services/token.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VirusScanService } from './services/virus-scan.service';
import { LoggerService } from './services/logger.service';
import { HttpModule } from '@nestjs/axios';
import { ObjectOmitter } from './services/object-utils.service';

@Module({
  imports: [
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRET_KEY'), // Or a default for seeding
        signOptions: { expiresIn: config.get('EXPIRES_IN') }, // Or a default
      }),
    }),
  ],
  providers: [
    PasswordUtils,
    TokenService,
    VirusScanService,
    ObjectOmitter,
    LoggerService,
  ],
  exports: [
    PasswordUtils,
    TokenService,
    VirusScanService,
    ObjectOmitter,
    LoggerService,
    HttpModule,
  ],
})
export class CommonModule {}
