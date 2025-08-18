import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PassportStatic } from 'passport';
import { OidcStrategy } from '../strategies/oidc.strategy';
import { OidcStrategyFactory } from '../factories/oidc-strategy.factory';
import { IdentityProvider } from '@prisma/client';
import { OidcProviderDbService } from './oidc-provider-db.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';

@Injectable()
export class OidcProviderService implements OnModuleInit {
  private readonly context = OidcProviderService.name;
  private readonly logger = new Logger(this.context);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    private readonly passport: PassportStatic,
  ) {}

  async onModuleInit() {
    await this.registerAllProviders();
  }

  async registerAllProviders() {
    // const providers = await this.prisma.identityProvider.findMany({
    //   where: { enabled: true },
    // });
    const providers = await this.dbService.getAllEnabledProviders();

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
    providerName: string,
  ): Promise<IdentityProvider> {
    return this.dbService.getProviderByName(providerName);
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    // 1. Save to database
    const provider = await this.dbService.createProvider(data);

    // 2. Register strategy if enabled
    if (provider.enabled) {
      this.registerProvider(provider);
    }

    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    // 1. Update in database
    const provider = await this.dbService.updateProvider(id, data);

    // 2. Unregister old strategy
    this.unregisterProvider(provider.name);

    // 3. Register new strategy if enabled
    if (provider.enabled) {
      this.registerProvider(provider);
    }

    return provider;
  }

  async deleteAndUnregisterProvider(id: number) {
    // 1. Get provider first
    const provider = await this.dbService.getProviderById(id);

    // 2. Unregister strategy
    this.unregisterProvider(provider.name);

    // 3. Delete from database
    return this.dbService.deleteProvider(id);
  }

  registerProvider(provider: IdentityProvider) {
    // const strategy = this.strategyFactory.createStrategy({
    //   ...provider,
    //   callbackURL: `${process.env.APP_URL}/auth/${provider.name}/callback`,
    // });
    const strategy = this.strategyFactory.createStrategy(provider);

    this.strategies.set(provider.name, strategy);
    this.passport.use(strategy);
  }

  unregisterProvider(providerName: string) {
    const strategy = this.strategies.get(providerName);
    if (strategy) {
      this.passport.unuse(strategy.name);
      this.strategies.delete(providerName);
    }
  }

  getStrategy(providerName: string): OidcStrategy | undefined {
    return this.strategies.get(providerName);
  }

  async refreshProviders() {
    this.strategies.clear();
    await this.registerAllProviders();
  }
}
