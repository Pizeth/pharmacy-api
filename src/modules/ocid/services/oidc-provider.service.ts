import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PassportStatic } from 'passport';
import { OidcStrategy } from '../strategies/oidc.strategy';
import { OidcStrategyFactory } from '../factories/oidc-strategy.factory';
import { IdentityProvider } from '@prisma/client';
import { OidcProviderDbService } from './oidc-provider-db.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import { AppError } from 'src/exceptions/app.exception';
import { CryptoService } from 'src/commons/services/crypto.service';
import { OidcIdentityDbService } from './oidc-identity-db.service';

@Injectable()
export class OidcProviderService implements OnModuleInit {
  private readonly context = OidcProviderService.name;
  private readonly logger = new Logger(this.context);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly identityService: OidcIdentityDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    private readonly passport: PassportStatic,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit() {
    try {
      await this.registerAllProviders();
      this.logger.log('All OIDC providers registered successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OIDC providers:', error);
      // Don't throw here - let the app start but with OIDC disabled
    }
  }

  // Add this method to handle composite unique key lookups
  async getOidcIdentity(providerId: number, providerUserId: string) {
    try {
      return this.identityService.getOidcIdentity({
        // AND: [{ providerId, providerUserId }],
        providerId_providerUserId: {
          providerId,
          providerUserId,
        },
      });
    } catch (error) {
      this.logger.error('Error occured during getOidcIdentity:', error);
      throw new AppError(
        'Error occured during retrieving OIDC Identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  async registerAllProviders() {
    const providers = await this.getAllEnabledProviders();

    for (const provider of providers) {
      try {
        this.registerProvider(provider);
        this.logger.log(`Registered OIDC provider: ${provider.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register provider ${provider.name}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  async getOidcIdentityProvider(
    name: string,
  ): Promise<IdentityProvider | null> {
    return this.dbService.getOne({ name });
  }

  async getAllEnabledProviders(): Promise<IdentityProvider[]> {
    const providers = await this.dbService.getAll();
    return providers.data.filter((p) => p.isEnabled);
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    // 1. Encrypt secret
    // const encryptedSecret = this.encryptSecret(data.clientSecret);
    const encryptedSecret = this.crypto.encrypt(data.clientSecret);
    const providerData = { ...data, clientSecret: encryptedSecret };

    // 2. Save to database
    const provider = await this.dbService.createProvider(providerData);

    // 3. Register strategy if enabled
    if (provider.isEnabled) {
      this.registerProvider(provider);
    }

    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    // 1. Encrypt secret
    // const encryptedSecret = data.clientSecret
    //   ? this.crypto.encrypt(data.clientSecret)
    //   : undefined;

    // data.clientSecret = encryptedSecret;
    if (data.clientSecret) {
      data.clientSecret = this.crypto.encrypt(data.clientSecret);
    }

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
    // const decryptedSecret = this.decryptSecret(provider.clientSecret);
    const clientSecret = this.crypto.decrypt(provider.clientSecret);
    const callbackURL = `${process.env.APP_URL}/auth/${provider.name}/callback`;
    // provider.clientSecret = decryptedSecret;
    // create a shallow copy so the factory receives decrypted secret
    const runtimeProvider = {
      ...provider,
      clientSecret,
      callbackURL,
    };

    // 2. Create strategy
    const strategy = this.strategyFactory.createStrategy(runtimeProvider);

    // 3. Register & use strategy
    this.passport.use(provider.name, strategy);

    // Store strategy reference
    this.strategies.set(strategy.name, strategy);

    this.logger.log(`Strategy registered for provider: ${provider.name}`);
  }

  private unregisterProvider(providerName: string) {
    const strategy = this.strategies.get(providerName);
    if (strategy) {
      this.passport.unuse(strategy.name);
      try {
        this.passport.unuse(strategy.name);
      } catch (error) {
        // passport.unuse may throw if not registered — ignore
        this.logger.error(
          `Failed to unregister strategy ${strategy.name}`,
          error,
        );
      }
      this.strategies.delete(providerName);
      this.logger.log(`Strategy unregistered for provider: ${providerName}`);
    }
  }

  async refreshProviders() {
    // Unregister all current strategies
    // this.strategies.forEach((_, name) => this.unregisterProvider(name));
    for (const name of Array.from(this.strategies.keys())) {
      this.unregisterProvider(name);
    }
    // this.strategies.clear();

    // Re-register all enabled providers from DB
    await this.registerAllProviders();
  }
}

@Injectable()
export class OidcProviderServiceDeepSeek implements OnModuleInit {
  private readonly logger = new Logger(OidcProviderService.name);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    private readonly passport: PassportStatic,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit() {
    await this.registerAllProviders();
  }

  async registerAllProviders() {
    const providers = await this.getAllEnabledProviders();

    for (const provider of providers) {
      try {
        await this.registerProvider(provider);
        this.logger.log(`Registered OIDC provider: ${provider.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register provider ${provider.name}`,
          error.stack,
        );
      }
    }
  }

  async getAllEnabledProviders(): Promise<IdentityProvider[]> {
    const providers = await this.dbService.getAll();
    return providers.data.filter((p) => p.isEnabled);
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    const encryptedSecret = this.crypto.encrypt(data.clientSecret);
    const provider = await this.dbService.createProvider({
      ...data,
      clientSecret: encryptedSecret,
    });

    if (provider.enabled) {
      await this.registerProvider(provider);
    }

    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    if (data.clientSecret) {
      data.clientSecret = this.crypto.encrypt(data.clientSecret);
    }

    const provider = await this.dbService.updateProvider(id, data);
    this.unregisterProvider(provider.name);

    if (provider.enabled) {
      await this.registerProvider(provider);
    }

    return provider;
  }

  async toggleProvider(id: number, enabled: boolean) {
    const provider = await this.dbService.updateProvider(id, { enabled });

    if (enabled) {
      await this.registerProvider(provider);
    } else {
      this.unregisterProvider(provider.name);
    }

    return provider;
  }

  async deleteAndUnregisterProvider(id: number) {
    const provider = await this.dbService.getOne({ id });
    if (!provider) {
      throw new AppError('Provider not found', HttpStatus.NOT_FOUND);
    }

    this.unregisterProvider(provider.name);
    return this.dbService.deleteProvider(id);
  }

  getStrategy(providerName: string): OidcStrategy | undefined {
    return this.strategies.get(providerName);
  }

  private async registerProvider(provider: IdentityProvider) {
    const decryptedSecret = this.crypto.decrypt(provider.clientSecret);
    const strategy = this.strategyFactory.createStrategy({
      ...provider,
      clientSecret: decryptedSecret,
    });

    this.strategies.set(provider.name, strategy);
    this.passport.use(strategy.name, strategy);
  }

  private unregisterProvider(providerName: string) {
    const strategy = this.strategies.get(providerName);
    if (strategy) {
      this.passport.unuse(strategy.name);
      this.strategies.delete(providerName);
    }
  }
}

@Injectable()
export class OidcProviderServiceClaude implements OnModuleInit {
  private readonly context = OidcProviderService.name;
  private readonly logger = new Logger(this.context);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    private readonly crypto: CryptoService,
    // private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    await this.registerAllProviders();
  }

  async registerAllProviders() {
    const providers = await this.getAllEnabledProviders();

    for (const provider of providers) {
      try {
        await this.registerProvider(provider);
        this.logger.log(`Registered OIDC provider: ${provider.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register provider ${provider.name}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  async getOidcIdentityProvider(
    name: string,
  ): Promise<IdentityProvider | null> {
    return this.dbService.getOne({ name });
  }

  async getAllEnabledProviders(): Promise<IdentityProvider[]> {
    const providers = await this.dbService.getAll();
    return providers.data.filter((p) => p.isEnabled);
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    const encryptedSecret = this.crypto.encrypt(data.clientSecret);
    data.clientSecret = encryptedSecret;

    const provider = await this.dbService.createProvider(data);

    if (provider.isEnabled) {
      await this.registerProvider(provider);
    }

    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    const encryptedSecret = data.clientSecret
      ? this.crypto.encrypt(data.clientSecret)
      : undefined;

    if (encryptedSecret) {
      data.clientSecret = encryptedSecret;
    }

    const provider = await this.dbService.updateProvider(id, data);

    await this.unregisterProvider(provider.name);

    if (provider.isEnabled) {
      await this.registerProvider(provider);
    }

    return provider;
  }

  async toggleProvider(id: number, isEnabled: boolean) {
    const provider = await this.dbService.updateProvider(id, { isEnabled });

    if (isEnabled) {
      await this.registerProvider(provider);
    } else {
      await this.unregisterProvider(provider.name);
    }

    return provider;
  }

  async deleteAndUnregisterProvider(id: number) {
    try {
      const provider = await this.dbService.getOne({ id });
      if (!provider) {
        throw new AppError(
          'Provider not found',
          HttpStatus.NOT_FOUND,
          this.context,
          { cause: `Provider with id ${id} does not exist!` },
        );
      }

      await this.unregisterProvider(provider.name);
      return this.dbService.deleteProvider(id);
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  getStrategy(providerName: string): OidcStrategy | undefined {
    return this.strategies.get(providerName);
  }

  private async registerProvider(provider: IdentityProvider) {
    // Decrypt secret
    const decryptedSecret = this.crypto.decrypt(provider.clientSecret);
    const providerWithDecryptedSecret = {
      ...provider,
      clientSecret: decryptedSecret,
    };

    // Create strategy
    const strategy = this.strategyFactory.createStrategy(
      providerWithDecryptedSecret,
    );

    // Register strategy with Passport
    passport.use(provider.name, strategy);

    // Store strategy reference
    this.strategies.set(provider.name, strategy);

    this.logger.log(`Strategy registered for provider: ${provider.name}`);
  }

  private async unregisterProvider(providerName: string) {
    const strategy = this.strategies.get(providerName);
    if (strategy) {
      passport.unuse(providerName);
      this.strategies.delete(providerName);
      this.logger.log(`Strategy unregistered for provider: ${providerName}`);
    }
  }

  async refreshProviders() {
    // Unregister all current strategies
    for (const providerName of this.strategies.keys()) {
      await this.unregisterProvider(providerName);
    }

    // Re-register all enabled providers
    await this.registerAllProviders();
  }
}

@Injectable()
export class OidcProviderServiceGemini implements OnModuleInit {
  private readonly context = OidcProviderService.name;
  private readonly logger = new Logger(this.context);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    private readonly crypto: CryptoService,
    // FIX: This is the correct way to inject the passport instance in NestJS
    @Inject(PASSPORT_INSTANCE) private readonly passport: PassportStatic,
  ) {}

  async onModuleInit() {
    await this.registerAllProviders();
  }

  // ... (the rest of your service methods like registerAllProviders, getOidcIdentityProvider, etc., are well-written and can remain unchanged)
  // Make sure they are all here.

  async registerAllProviders() {
    const providers = await this.getAllEnabledProviders();
    for (const provider of providers) {
      try {
        this.registerProvider(provider);
        this.logger.log(`Registered OIDC provider: ${provider.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register provider ${provider.name}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  getStrategy(providerName: string): OidcStrategy | undefined {
    return this.strategies.get(providerName);
  }

  private registerProvider(provider: IdentityProvider) {
    const decryptedSecret = this.crypto.decrypt(provider.clientSecret);
    const providerWithDecryptedSecret = {
      ...provider,
      clientSecret: decryptedSecret,
    };

    const strategy = this.strategyFactory.createStrategy(
      providerWithDecryptedSecret,
    );

    // FIX: Passport's `use` method takes the strategy name as the first argument.
    // Your OidcStrategy correctly sets its own name, so we use `strategy.name`.
    this.passport.use(strategy.name, strategy);
    this.strategies.set(strategy.name, strategy);
    this.logger.log(`Strategy registered for provider: ${strategy.name}`);
  }

  private unregisterProvider(providerName: string) {
    const strategy = this.strategies.get(providerName);
    if (strategy) {
      // Passport's `unuse` method takes the strategy's name.
      this.passport.unuse(strategy.name);
      this.strategies.delete(providerName);
      this.logger.log(`Strategy unregistered for provider: ${providerName}`);
    }
  }

  // --- ALL YOUR OTHER METHODS (create, update, delete, etc.) GO HERE ---
  // They are logically sound and do not need changes based on this refactor.
  // Just ensure they are included in the final file.
  async getOidcIdentityProvider(
    name: string,
  ): Promise<IdentityProvider | null> {
    return this.dbService.getOne({ name });
  }

  async getAllEnabledProviders(): Promise<IdentityProvider[]> {
    const result = await this.dbService.getAll(1, 1000, undefined, {
      isEnabled: true,
    }); // Fetch all enabled
    return result.data;
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    const encryptedSecret = this.crypto.encrypt(data.clientSecret);
    const providerData = { ...data, clientSecret: encryptedSecret };
    const provider = await this.dbService.createProvider(providerData);
    if (provider.isEnabled) {
      this.registerProvider(provider);
    }
    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    const providerToUpdate = await this.dbService.getOne({ id });
    if (!providerToUpdate) {
      throw new AppError(
        'Provider not found',
        HttpStatus.NOT_FOUND,
        this.context,
      );
    }
    const oldName = providerToUpdate.name;

    if (data.clientSecret) {
      data.clientSecret = this.crypto.encrypt(data.clientSecret);
    }
    const provider = await this.dbService.updateProvider(id, data);
    this.unregisterProvider(oldName);
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
    const provider = await this.dbService.getOne({ id });
    if (!provider) {
      throw new AppError(
        'Provider not found',
        HttpStatus.NOT_FOUND,
        this.context,
      );
    }
    this.unregisterProvider(provider.name);
    return this.dbService.deleteProvider(id);
  }

  async refreshProviders() {
    this.strategies.forEach((_, name) => this.unregisterProvider(name));
    this.strategies.clear();
    await this.registerAllProviders();
  }
}

@Injectable()
export class OidcProviderServiceGPT implements OnModuleInit {
  private readonly context = OidcProviderService.name;
  private readonly logger = new Logger(this.context);
  private strategies: Map<string, OidcStrategy> = new Map();

  constructor(
    private readonly dbService: OidcProviderDbService,
    private readonly strategyFactory: OidcStrategyFactory,
    @Inject('PASSPORT') private readonly passport: PassportStatic,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit() {
    await this.registerAllProviders();
  }

  async registerAllProviders() {
    const providers = await this.getAllEnabledProviders();
    for (const provider of providers) {
      try {
        this.registerProvider(provider);
        this.logger.log(`Registered OIDC provider: ${provider.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register provider ${provider.name}`,
          error,
        );
      }
    }
  }

  async getOidcIdentityProvider(
    name: string,
  ): Promise<IdentityProvider | null> {
    return this.dbService.getOne({ name });
  }

  async getAllEnabledProviders(): Promise<IdentityProvider[]> {
    const providers = await this.dbService.getAll();
    return providers.data.filter((p) => p.isEnabled);
  }

  async createAndRegisterProvider(data: CreateProviderDto) {
    // encrypt secret before saving
    const encryptedSecret = this.crypto.encrypt(data.clientSecret);
    data.clientSecret = encryptedSecret;

    const provider = await this.dbService.createProvider(data);

    if (provider.isEnabled) {
      this.registerProvider(provider);
    }
    return provider;
  }

  async updateAndReregisterProvider(id: number, data: UpdateProviderDto) {
    if (data.clientSecret) {
      data.clientSecret = this.crypto.encrypt(data.clientSecret);
    }

    const provider = await this.dbService.updateProvider(id, data);

    // unregister any existing strategy (by provider.name)
    this.unregisterProvider(provider.name);

    if (provider.isEnabled) {
      this.registerProvider(provider);
    }

    return provider;
  }

  async toggleProvider(id: number, isEnabled: boolean) {
    const provider = await this.dbService.updateProvider(id, { isEnabled });
    if (isEnabled) this.registerProvider(provider);
    else this.unregisterProvider(provider.name);
    return provider;
  }

  async deleteAndUnregisterProvider(id: number) {
    const provider = await this.dbService.getOne({ id });
    if (!provider) {
      throw new AppError(
        'Provider not found',
        HttpStatus.NOT_FOUND,
        this.context,
        { cause: `Provider ${id} not found` },
      );
    }
    this.unregisterProvider(provider.name);
    return this.dbService.deleteProvider(id);
  }

  getStrategy(providerName: string) {
    return this.strategies.get(providerName);
  }

  private registerProvider(provider: IdentityProvider) {
    // decrypt secret for runtime use
    const decryptedSecret = this.crypto.decrypt(provider.clientSecret);
    // create a shallow copy so the factory receives decrypted secret
    const runtimeProvider = { ...provider, clientSecret: decryptedSecret };

    // create a strategy instance with provider name set as strategy name inside factory
    const strategy = this.strategyFactory.createStrategy(runtimeProvider);

    // register on passport under provider.name (factory must set strategy name)
    this.passport.use(strategy);
    this.strategies.set(provider.name, strategy);
  }

  private unregisterProvider(providerName: string) {
    if (this.strategies.has(providerName)) {
      try {
        this.passport.unuse(providerName);
      } catch (err) {
        // passport.unuse may throw if not registered — ignore
      }
      this.strategies.delete(providerName);
    }
  }

  async refreshProviders() {
    // Unregister all current strategies
    for (const name of Array.from(this.strategies.keys())) {
      this.unregisterProvider(name);
    }
    // Re-register from DB
    await this.registerAllProviders();
  }
}

// private encryptSecret(secret: string): string {
//   const iv = crypto.randomBytes(16);
//   const encryptionKey = this.config.get<string>('ENCRYPTION_KEY', '');
//   const cipher = crypto.createCipheriv(
//     'aes-256-cbc',
//     Buffer.from(encryptionKey),
//     iv,
//   );

//   let encrypted = cipher.update(secret, 'utf8', 'hex');
//   encrypted += cipher.final('hex');
//   return `${iv.toString('hex')}:${encrypted}`;
// }

// private decryptSecret(encrypted: string): string {
//   const [ivHex, secret] = encrypted.split(':');
//   const encryptionKey = this.config.get<string>('ENCRYPTION_KEY', '');
//   // const encryptionKey = process.env.ENCRYPTION_KEY;
//   // if (!encryptionKey) {
//   //   throw new Error('ENCRYPTION_KEY environment variable is not set.');
//   // }
//   const iv = Buffer.from(ivHex, 'hex');
//   const decipher = crypto.createDecipheriv(
//     'aes-256-cbc',
//     Buffer.from(encryptionKey),
//     iv,
//   );

//   let decrypted = decipher.update(secret, 'hex', 'utf8');
//   decrypted += decipher.final('utf8');
//   return decrypted;
// }
