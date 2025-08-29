import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TimeParserModule } from 'src/modules/time-parser/time-parser.module';
import { ClsModule, ClsService } from 'nestjs-cls';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { TokenService } from 'src/commons/services/token.service';
import { PrismaService } from '../../services/prisma.service';
import { TimeParserService } from 'src/modules/time-parser/services/time-parser.service/time-parser.service';

@Module({
  imports: [PrismaModule, ConfigModule, JwtModule, TimeParserModule, ClsModule],
  providers: [
    {
      provide: PasswordUtils,
      useFactory: (config: ConfigService) => {
        console.log('[BOOT] PasswordUtils factory start');
        const csv = new PasswordUtils(config);
        console.log('[BOOT] PasswordUtils factory done');
        return csv;
      },
      inject: [ConfigService],
    },
    {
      provide: TokenService,
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
        jwt: JwtService,
        parser: TimeParserService,
        cls: ClsService,
      ) => {
        console.log('[BOOT] TokenService factory start');
        const csv = new TokenService(config, prisma, jwt, parser, cls);
        console.log('[BOOT] TokenService factory done');
        return csv;
      },
      inject: [
        ConfigService,
        PrismaService,
        JwtService,
        TimeParserService,
        ClsService,
      ],
    },
  ],
  exports: [PasswordUtils, TokenService, TimeParserModule],
})
export class SeedHelpersModule {}
