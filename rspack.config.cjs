// rspack.config.cjs

/* eslint-disable @typescript-eslint/no-require-imports */

const path = require('node:path');

/**
 * NestJS 12 Rspack compatibility override.
 *
 * Nest passes its generated default Rspack configuration as `options`.
 *
 * We keep almost all of it, but:
 *
 * 1. Remove `resolve.plugins`
 *    Rspack has native TypeScript path resolution through
 *    `resolve.tsConfig`, so the old TsconfigPathsPlugin layer is not
 *    needed.
 *
 * 2. Make the tsconfig path explicitly absolute.
 *
 * 3. Make output.path explicitly absolute.
 *
 * This keeps the workaround very small and isolated.
 *
 * @param {import('@rspack/core').Configuration} options
 *   NestJS-generated Rspack configuration.
 *
 * @returns {import('@rspack/core').Configuration}
 *   Final Rspack configuration.
 */
module.exports = function rspackConfig(options) {
  const projectRoot = process.cwd();

  const tsConfigPath = path.resolve(projectRoot, 'tsconfig.build.json');

  const outputPath = path.resolve(projectRoot, 'dist');

  /**
   * Nest 12 currently puts TsconfigPathsPlugin here.
   *
   * Do not pass that property into Rspack.
   */
  const { plugins: _unusedResolvePlugins, ...resolveWithoutPlugins } =
    options.resolve ?? {};

  return {
    ...options,

    /**
     * Explicit project context.
     */
    context: projectRoot,

    /**
     * Normalize all filesystem paths before they reach the native
     * Rspack resolver.
     */
    output: {
      ...options.output,
      path: outputPath,
    },

    resolve: {
      ...resolveWithoutPlugins,

      /**
       * Rspack's native TypeScript path resolver.
       *
       * Use an absolute path rather than relying on the CLI's relative
       * tsconfig path.
       */
      tsConfig: tsConfigPath,
    },
  };
};
