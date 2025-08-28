import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PassportStatic } from 'passport';
import { OidcStrategy } from '../strategies/oidc.strategy';
import { OidcStrategyFactory } from '../factories/oidc-strategy.factory';
import { IdentityProvider } from '@prisma/client';
import { OidcProviderDbService } from './oidc-provider-db.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AppError } from 'src/exceptions/app.exception';

@Injectable()
export class OidcProviderService implements OnModuleInit {
  private readonly context = OidcProviderService.name;
  private readonly logger = new Logger(this.context);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    private readonly passport: PassportStatic,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.registerAllProviders();
  }

  async registerAllProviders() {
    // const providers = await this.prisma.identityProvider.findMany({
    //   where: { enabled: true },
    // });
    // const providers = await this.dbService.getAllEnabledProviders();
    const providers = await this.getAllEnabledProviders();

    for (const provider of providers) {
      try {
        this.registerProvider(provider);
        this.logger.log(`Registered OIDC provider: ${provider.name}`);
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(
            `Failed to register provider ${provider.name}`,
            error.stack,
          );
        } else {
          this.logger.error(
            `Failed to register provider ${provider.name}`,
            error,
          );
        }
      }
    }
  }

  async getOidcIdentityProvider(
    name: string,
  ): Promise<IdentityProvider | null> {
    return this.dbService.getOne({ name });
  }

  async getAllEnabledProviders(): Promise<IdentityProvider[]> {
    // const providers = await this.dbService.getAllEnabledProviders();
    const providers = await this.dbService.getAll();
    return providers.data.filter((p) => p.isEnabled);
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    // 1. Encrypt secret
    const encryptedSecret = this.encryptSecret(data.clientSecret);
    data.clientSecret = encryptedSecret;

    // 2. Save to database
    const provider = await this.dbService.createProvider(data);

    // 3. Register strategy if enabled
    if (provider.isEnabled) {
      this.registerProvider(provider);
    }

    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    // 1. Encrypt secret
    const encryptedSecret = data.clientSecret
      ? this.encryptSecret(data.clientSecret)
      : undefined;

    data.clientSecret = encryptedSecret;

    // 2. Update in database
    const provider = await this.dbService.updateProvider(id, data);

    // 3. Unregister old strategy
    this.unregisterProvider(provider.name);

    // 4. Register new strategy if enabled
    if (provider.isEnabled) {
      this.registerProvider(provider);
    }

    return provider;
  }

  async toggleProvider(id: number, isEnabled: boolean) {
    const provider = await this.dbService.updateProvider(id, { isEnabled });

    if (isEnabled) {
      this.registerProvider(provider);
    } else {
      this.unregisterProvider(provider.name);
    }

    return provider;
  }

  async deleteAndUnregisterProvider(id: number) {
    try {
      // 1. Get provider first
      const provider = await this.dbService.getOne({ id });
      if (!provider)
        throw new AppError(
          'Provider not found',
          HttpStatus.NOT_FOUND,
          this.context,
          {
            cause: `Provider with id ${id} does not exist!`,
          },
        );

      // 2. Unregister strategy
      this.unregisterProvider(provider.name);

      // 3. Delete from database
      return this.dbService.deleteProvider(id);
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  getStrategy(providerName: string): OidcStrategy | undefined {
    return this.strategies.get(providerName);
  }

  private registerProvider(provider: IdentityProvider) {
    // const strategy = this.strategyFactory.createStrategy({
    //   ...provider,
    //   callbackURL: `${process.env.APP_URL}/auth/${provider.name}/callback`,
    // });

    // 1. Decrypt secret
    const decryptedSecret = this.decryptSecret(provider.clientSecret);
    provider.clientSecret = decryptedSecret;

    // 2. Create strategy
    const strategy = this.strategyFactory.createStrategy(provider);

    // 3. Register & use strategy
    this.strategies.set(provider.name, strategy);
    this.passport.use(strategy);
  }

  private unregisterProvider(providerName: string) {
    const strategy = this.strategies.get(providerName);
    if (strategy) {
      this.passport.unuse(strategy.name);
      this.strategies.delete(providerName);
    }
  }

  private encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const encryptionKey = this.config.get<string>('ENCRYPTION_KEY', '');
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(encryptionKey),
      iv,
    );

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptSecret(encrypted: string): string {
    const [ivHex, secret] = encrypted.split(':');
    const encryptionKey = this.config.get<string>('ENCRYPTION_KEY', '');
    // const encryptionKey = process.env.ENCRYPTION_KEY;
    // if (!encryptionKey) {
    //   throw new Error('ENCRYPTION_KEY environment variable is not set.');
    // }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(encryptionKey),
      iv,
    );

    let decrypted = decipher.update(secret, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async refreshProviders() {
    this.strategies.clear();
    await this.registerAllProviders();
  }
}
