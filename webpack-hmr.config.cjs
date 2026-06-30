/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// import nodeExternals from 'webpack-node-externals';
// import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin'); // 👈 Add this import
// 👇 Add this explicit require at the top
// const webpackInstance = require('webpack');

module.exports = function (options, webpack) {
  // Check if Webpack is running in watch mode (local dev)
  const isWatch = options.watch || process.argv.includes('--watch');

  const config = {
    ...options,
    // entry: ['webpack/hot/poll?100', options.entry],
    // 👇 Dynamically clear out the HMR entry poller if we aren't explicitly watching files
    // entry: isWatch ? ['webpack/hot/poll?100', options.entry] : options.entry,
    entry: options.entry,
    // 1. Force external packages to rely on modern ESM import statements
    externalsType: 'import', // 👈 Enable ESM import statements for externals
    externals: [
      nodeExternals({
        // allowlist: ['webpack/hot/poll?100', /^@dicebear/],
        // allowlist: isWatch
        //   ? ['webpack/hot/poll?100', /^@dicebear/]
        //   : [/^@dicebear/],
        allowlist: [/^@dicebear/], // 👈 Cleaned up the poll entry here
        importType: 'module', // 👈 CHANGE from 'commonjs' to 'module'
        // importType: 'commonjs',
      }),
    ],
    // Change the bundle file extension to .cjs so Node treats it as CommonJS
    output: {
      ...options.output,
      // filename: 'main.cjs',
      // libraryTarget: 'commonjs2',
      filename: 'main.js', // 👈 CHANGE back to standard .js extension
      chunkFormat: 'module', // 👈 Tell Webpack to emit modern module chunks
      library: {
        type: 'module', // 👈 CHANGE from 'commonjs2' to output modern ES module syntax
      },
      // 👇 ADD THESE TWO LINES TO FORCE REUSABLE EXTENSIONS FOR ESM CHUNKS
      hotUpdateMainFilename: '[runtime].[fullhash].hot-update.json',
      hotUpdateChunkFilename: '[id].[fullhash].hot-update.js',
    },

    // 2. MOVE EXPERIMENTS HERE (Top-level configuration)
    experiments: {
      outputModule: true, // 👈 Required to make Webpack output true import/export code
    },

    // 🧠 ✅ THE FIX: Map Prisma's explicit .js imports directly back to your .ts source files
    resolve: {
      ...options.resolve,
      extensionAlias: {
        '.js': ['.ts', '.js'],
      },
    },

    // 👈 ADD THIS BLOCK HERE
    // Tells Webpack to replace __dirname with the correct runtime path in ESM
    node: {
      __dirname: true,
      __filename: true,
    },

    target: 'node',
    plugins: [
      ...(options.plugins || []),
      // 🧠 ✅ THE FIX: Tell Webpack to copy your assets relative to the output main.js bundle file
      new CopyPlugin({
        patterns: [
          { from: 'src/i18n', to: 'i18n' },
          { from: 'src/assets', to: 'assets' },
        ],
      }),
      // new webpack.HotModuleReplacementPlugin(),
      // new webpack.WatchIgnorePlugin({
      //   paths: [/\.js$/, /\.d\.ts$/],
      // }),
      // new RunScriptWebpackPlugin({
      //   // Fallback to 'main.js' if options.output is undefined
      //   name: options.output?.filename || 'main.js',
      //   // Sync the runner script name with the new .cjs output
      //   // name: 'main.cjs',
      //   autoRestart: false,
      // }),
    ],
  };

  // Clean out NestJS internal CLI flags so Webpack schema validation passes perfectly
  delete config.WEBPACK_WATCH;
  delete config.WEBPACK_BUILD;

  // Only inject dev-only Hot Module Replacement plugins if actively developing locally
  if (isWatch) {
    config.output.hotUpdateMainFilename =
      '[runtime].[fullhash].hot-update.json';
    config.output.hotUpdateChunkFilename = '[id].[fullhash].hot-update.js';

    config.plugins.push(
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      // 👇 Use the guaranteed local instance here
      // new webpackInstance.HotModuleReplacementPlugin(),
      // new webpackInstance.WatchIgnorePlugin({
      //   paths: [/\.js$/, /\.d\.ts$/],
      // }),
      new RunScriptWebpackPlugin({
        // ✅ Uses optional chaining to prevent undefined reading crashes
        name: options.output?.filename || 'main.js',
        // autoRestart: false,
        autoRestart: true,
      }),
    );
  }

  return config;
};
