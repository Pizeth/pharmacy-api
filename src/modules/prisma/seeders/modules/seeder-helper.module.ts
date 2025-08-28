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
      useFactory: (config: ConfigService) => new PasswordUtils(config),
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
      ) => new TokenService(config, prisma, jwt, parser, cls),
      inject: [
        ConfigService,
        PrismaService,
        JwtService,
        TimeParserService,
        ClsService,
      ],
    },
  ],
  exports: [PasswordUtils, TokenService],
})
export class SeedHelpersModule {}
