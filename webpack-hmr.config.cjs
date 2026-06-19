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
    // externalsType: 'module-import',
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100', /^@dicebear/],
        // importType: 'module',
        importType: 'commonjs',
      }),
    ],
    // Change the bundle file extension to .cjs so Node treats it as CommonJS
    output: {
      ...options.output,
      filename: 'main.cjs',
      libraryTarget: 'commonjs2',
    },
    target: 'node',
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        // name: options.output.filename,
        // Sync the runner script name with the new .cjs output
        name: 'main.cjs',
        autoRestart: false,
      }),
    ],
  };
};
