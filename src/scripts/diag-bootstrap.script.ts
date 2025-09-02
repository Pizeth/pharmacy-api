import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import type { Type, DynamicModule } from '@nestjs/common';
import { Logger, Module } from '@nestjs/common';
import { CacheService } from 'src/modules/cache/services/cache.service';
import { SeederModule } from 'src/modules/prisma/seeders/seeder.module';
import { BKTreeService } from 'src/modules/suggestion/services/bk-tree/bk-tree.service';
import { LevenshteinService } from 'src/modules/suggestion/services/levenshtein/levenshtein.service';
import { SuggestionService } from 'src/modules/suggestion/services/suggestion.service';
import { SuggestionModule } from 'src/modules/suggestion/suggestion.module';
import { TimeParserService } from 'src/modules/time-parser/services/time-parser.service/time-parser.service';
import { TimeParserModule } from 'src/modules/time-parser/time-parser.module';
import { CacheModule } from 'src/modules/cache/cache.module';
import { LevenshteinModule } from 'src/modules/suggestion/services/levenshtein/levenshtein.module';

const logger = new Logger('DiagBootstrap');

type ModuleEntry = { name: string; module: Type<any> | DynamicModule };

/**
 * Try to create an application context with timeout.
 * Returns the context when successful, otherwise throws the original error.
 */
async function createContextWithTimeout(
  moduleEntry: ModuleEntry,
  ms = 10_000,
): Promise<INestApplicationContext> {
  logger.log(
    `→ createApplicationContext for: ${moduleEntry.name} (timeout ${ms}ms)`,
  );
  return Promise.race([
    NestFactory.createApplicationContext(moduleEntry.module, {
      logger: ['error', 'warn', 'debug', 'log'],
    }),
    new Promise<INestApplicationContext>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`createApplicationContext timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

async function tryBootstrap(moduleEntry: ModuleEntry, timeoutMs = 10_000) {
  logger.log(`\n=== Trying: ${moduleEntry.name} ===`);
  let ctx: INestApplicationContext | null = null;
  try {
    ctx = await createContextWithTimeout(moduleEntry, timeoutMs);
    logger.log(`✅ Bootstrap OK for: ${moduleEntry.name}`);
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error(`❌ Failed to bootstrap ${moduleEntry.name}: ${e.message}`);
    if (e.stack) logger.debug(e.stack);
    // Try to heuristically extract common Nest "can't resolve dependencies" lines
    const text = e.message + (e.stack ? '\n' + e.stack : '');
    const match =
      text.match(
        /Nest can't resolve dependencies of the (\w+)[\s\S]*?:(?:\s*([^)]+))?/i,
      ) ||
      text.match(/was not injected/i) ||
      text.match(/Cannot read properties of undefined/i);
    if (match) logger.warn(`Heuristic hint from error: ${match[0]}`);
    return false;
  }

  // If we got a context, try resolving known probe providers
  const probes = [
    CacheService,
    LevenshteinService,
    SuggestionService,
    TimeParserService,
    // BKTreeService,
    // LevenshteinService,
  ];
  for (const p of probes) {
    try {
      const inst = ctx.get(p, { strict: false }); // attempt non-strict get first
      logger.debug(`${p.name} resolved: ${!!inst}`);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `❌ ${moduleEntry.name}: Failed to resolve ${p.name}: ${e.message}`,
      );
      if (e.stack) logger.debug(e.stack);
    }
  }

  // Also enumerate all providers registered in the context (best-effort)
  try {
    // Access Nest internals carefully for a helpful debug list (best-effort; may change with Nest versions)
    // avoid unsafe `any` by using `unknown` and narrow types before access
    const container = (
      ctx as unknown as {
        container?: { getModules?: () => Map<unknown, unknown> };
      }
    ).container;
    if (container && typeof container.getModules === 'function') {
      // for each module in the container, list provider tokens count
      // This prints simplified module -> provider keys mapping
      // WARNING: this uses internals; it's only for debugging
      const modulesMap = container.getModules();
      const moduleEntries = Array.from(modulesMap.entries()).map(
        ([key, value]) => {
          const maybeProviders = value as
            | { providers?: Map<unknown, unknown> }
            | undefined;
          const modProviders =
            maybeProviders && maybeProviders.providers
              ? Array.from(maybeProviders.providers.keys())
              : [];
          return {
            key: (key && (key as { name?: string }).name) || String(key),
            providersCount: modProviders.length,
          };
        },
      );
      logger.log('Context modules snapshot (name : providersCount):');
      for (const me of moduleEntries) {
        const keyStr =
          typeof me.key === 'string'
            ? me.key
            : (() => {
                try {
                  return JSON.stringify(me.key);
                } catch {
                  return Object.prototype.toString.call(me.key);
                }
              })();
        logger.log(` - ${keyStr} : ${me.providersCount} providers`);
      }
    }
  } catch (err) {
    logger.debug(
      'Failed to enumerate container modules (non-fatal): ' + String(err),
    );
  }

  // clean up
  try {
    await ctx.close();
  } catch (_e) {
    /* ignore */
    logger.debug('Failed to close context (non-fatal): ' + String(_e));
  }
  return true;
}

async function runAll() {
  const moduleSets: ModuleEntry[] = [
    // {
    //   name: 'CacheModule alone',
    //   module: CacheModule,
    // },
    // {
    //   name: 'LvenshteinModule alone',
    //   module: LevenshteinModule,
    // },
    // { name: 'SuggestionModule alone', module: SuggestionModule },

    {
      name: 'Suggestion + Lvenshtein',
      module: (() => {
        @Module({ imports: [CacheModule, LevenshteinModule, SuggestionModule] })
        class M {}
        return M;
      })(),
    },
    // {
    //   name: 'TimeParserModule alone',
    //   module: TimeParserModule,
    // },
    // {
    //   name: 'TimeParser + Suggestion + Cache',
    //   module: (() => {
    //     @Module({ imports: [CacheModule, SuggestionModule, TimeParserModule] })
    //     class M {}
    //     return M;
    //   })(),
    // },
    // { name: 'SeedHelpersModule', module: SeedHelpersModule },
    // { name: 'SeederModule (full)', module: SeederModule },
  ];

  for (const mod of moduleSets) {
    // give longer timeout for combos that include many imports
    const timeoutMs = mod.name.includes('full') ? 30_000 : 10_000;
    // Try 3x with increasing verbosity/timeouts if it fails initially
    const ok = await tryBootstrap(mod, timeoutMs);
    if (!ok) {
      logger.warn(
        `→ The blocker is likely inside or a dependency of: ${mod.name}`,
      );
      // don't break — continue to collect data for other sets
    }
    // small pause to avoid log interleaving on some systems
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.log('\nAll done.');
  process.exit(0);
}

runAll().catch((e) => {
  logger.error(
    'Unexpected diag script failure:',
    e instanceof Error ? (e.stack ?? e.message) : String(e),
  );
  process.exit(2);
});
