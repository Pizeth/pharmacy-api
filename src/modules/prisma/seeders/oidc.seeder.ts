import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IdentityProvider } from '@prisma/client';
import { SanitizedUser } from 'src/types/dto';
import * as crypto from 'crypto';
import data from '../data/oidc.json';
import { AppError } from 'src/exceptions/app.exception';

@Injectable()
export class OidcSeeder {
  private readonly context = OidcSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.logger.debug('OidcSeeder constructor called');
    this.logger.debug(`PrismaService injected: ${!!this.prisma}`);
    this.logger.debug(`ConfigService injected: ${!!this.config}`);
  }

  async seed(user: SanitizedUser): Promise<IdentityProvider[]> {
    this.logger.log('🌱 Seeding oidc provider from oidc.json...');
    this.logger.debug(`PrismaService resolved: ${!!this.prisma}`);
    this.logger.debug(`ConfigService resolved: ${!!this.config}`);

    const providers = this.getProvidersFromData(user.id);
    try {
      for (const provider of providers) {
        const name = provider.name.toUpperCase();
        const clientID = this.getDataFromEnv(`${name}_CLIENT_ID`, name);
        const clientSecret = this.encryptSecret(
          this.getDataFromEnv(`${name}_CLIENT_SECRET`, name),
        );

        await this.prisma.identityProvider.upsert({
          where: { name: provider.name },
          update: {
            ...provider,
            clientID,
            clientSecret,
          },
          create: {
            ...provider,
            clientID,
            clientSecret,
          },
        });
      }
      return await this.prisma.identityProvider.findMany();
    } catch (error) {
      this.logger.error(
        `Failed to seed OIDC Providers for ${user.username} with ${user.role.name} roles`,
        error,
      );
      throw new AppError(
        'Failed to seed OIDC Providers',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  private getProvidersFromData(id: number) {
    return data.oidc.map((odic) => ({
      name: odic.name,
      displayName: odic.displayName,
      issuer: odic.issuer,
      authorizationURL: odic.authorizationURL,
      tokenURL: odic.tokenURL,
      callbackURL: odic.callbackURL,
      userInfoURL: odic.userInfoURL,
      createdBy: id,
      lastUpdatedBy: id,
    }));
  }

  private getDataFromEnv(key: string, provider: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      this.logger.warn(
        `${key} for provider ${provider} not found in environment variables.`,
      );
      throw new AppError(
        `${key} for provider ${provider} not found in environment variables.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        {
          cause: `${key} is undefined`,
          validKey: Object.keys(process.env),
        },
      );
    }
    return value;
  }

  private encryptSecret(secret: string): string {
    const encryptionKey = this.config.get<string>('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new AppError(
        'Encryption key not found in environment variables.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        {
          cause: 'ENCRYPTION_KEY is undefined',
          validKey: Object.keys(process.env),
        },
      );
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(encryptionKey),
      iv,
    );

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }
}
