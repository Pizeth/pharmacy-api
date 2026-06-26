/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// import nodeExternals from 'webpack-node-externals';
// import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    // 1. Force external packages to rely on modern ESM import statements
    externalsType: 'module-import', // 👈 Enable ESM import statements for externals
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100', /^@dicebear/],
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

    // 👈 ADD THIS BLOCK HERE
    // Tells Webpack to replace __dirname with the correct runtime path in ESM
    node: {
      __dirname: true,
      __filename: true,
    },

    target: 'node',
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        // Sync the runner script name with the new .cjs output
        // name: 'main.cjs',
        autoRestart: false,
      }),
    ],
  };
};
