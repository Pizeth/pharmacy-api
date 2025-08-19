// import { Module, DynamicModule, Provider } from '@nestjs/common';
// import { PassportModule } from '@nestjs/passport';
// import { ConfigModule } from '@nestjs/config';
// import { OIDCConfigService } from './services/oidc-config.service';
// import { AuthService } from '../auth/services/auth.service';
// // import { OIDCConfigService } from './oidc-config.service';
// // import { AuthService } from '../auth.service';
// // import { createOIDCStrategy } from './create-oidc-strategy';

// @Module({})
// export class DynamicOIDCModule {
//   static forRoot(): DynamicModule {
//     return {
//       module: DynamicOIDCModule,
//       imports: [PassportModule, ConfigModule],
//       providers: [
//         OIDCConfigService,
//         {
//           provide: 'OIDC_STRATEGIES',
//           useFactory: (
//             oidcConfigService: OIDCConfigService,
//             authService: AuthService,
//           ) => {
//             const enabledProviders = oidcConfigService.getEnabledProviders();
//             const strategies: Provider[] = [];

//             enabledProviders.forEach((config) => {
//               const StrategyClass = createOIDCStrategy(config);
//               strategies.push({
//                 provide: `${config.name.toUpperCase()}_OIDC_STRATEGY`,
//                 useFactory: () => new StrategyClass(authService),
//                 inject: [AuthService],
//               });
//             });

//             return strategies;
//           },
//           inject: [OIDCConfigService, AuthService],
//         },
//       ],
//       exports: [OIDCConfigService, 'OIDC_STRATEGIES'],
//     };
//   }
// }

import {
  ConfigurableModuleBuilder,
  DynamicModule,
  Module,
  Provider,
} from '@nestjs/common';
import { OidcStrategy } from './strategies/oidc.strategy';
import { OIDCProviderConfig } from './interfaces/oidc.interface';
import { AuthService } from '../auth/services/auth.service';
import { IdentityProvider } from '@prisma/client';
import { OidcStrategyFactory } from './factories/oidc-strategy.factory';
import { OidcProviderService } from './services/oidc-provider.service';
import { PassportStatic } from 'passport';

// Define a constant for the injection token
export const OIDC_CONFIG = 'OIDC_CONFIG';

// This builder simplifies creating dynamic modules that accept options.
const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<OIDCProviderConfig[]>().build();

@Module({
  providers: [
    // This provider uses the options passed to register/registerAsync
    // to create and provide all the necessary strategy instances.
    {
      provide: 'OIDC_STRATEGIES', // A custom token for the created strategies
      // useFactory: (configs: OIDCProviderConfig[], authService: AuthService) => {
      useFactory: (provider: IdentityProvider[], authService: AuthService) => {
        // This maps over the config array and creates a new strategy for each one
        return provider.map((config) => new OidcStrategy(authService, config));
      },
      // Inject the module options (our config array) and the AuthService
      inject: [MODULE_OPTIONS_TOKEN, AuthService],
    },
    // AuthService is needed by the factory, so it must be available here.
    AuthService,
  ],
  exports: ['OIDC_STRATEGIES'],
})
export class OidcModule1 extends ConfigurableModuleClass {}

// @Module({})
// export class OidcModule {
//   static register(configs: OIDCProviderConfig[]): DynamicModule {
//     const strategyProviders: Provider[] = configs.map((config) => ({
//       // Provide a unique token for each strategy
//       provide: `${config.name.toUpperCase()}_OIDC_STRATEGY`,
//       // useFactory allows us to dynamically create the provider
//       useFactory: (authService: AuthService) => {
//         return new OidcStrategy(authService, config);
//       },
//       // Inject the AuthService, which the factory needs
//       inject: [AuthService],
//     }));

//     return {
//       module: OidcModule,
//       // The providers array will contain an OidcStrategy for each config
//       providers: [...strategyProviders],
//       // Export them so they are available to the rest of the NestJS application
//       exports: [...strategyProviders],
//     };
//   }
// }

@Module({})
export class OidcModule {
  static registerAsync(): DynamicModule {
    const providers: Provider[] = [
      OidcProviderService,
      OidcStrategyFactory,
      {
        provide: 'OIDC_STRATEGIES',
        useFactory: async (
          providerService: OidcProviderService,
          strategyFactory: OidcStrategyFactory,
          passport: PassportStatic,
        ) => {
          const providers = await providerService.getAllEnabledProviders();
          const strategies = providers.map((provider) =>
            strategyFactory.createStrategy(provider),
          );

          // Register strategies with Passport
          strategies.forEach((strategy) => {
            passport.use(strategy.name, strategy);
          });

          return strategies;
        },
        inject: [OidcProviderService, OidcStrategyFactory],
      },
      {
        provide: 'OIDC_PROVIDER_SERVICE',
        useClass: OidcProviderService,
      },
    ];

    return {
      module: OidcModule,
      providers: [...providers, AuthService],
      exports: ['OIDC_STRATEGIES'],
    };
  }
}
