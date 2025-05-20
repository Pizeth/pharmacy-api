import nodeExternals from 'webpack-node-externals';
import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
import * as webpack from 'webpack';

interface WebpackOptions {
  entry: string | string[];
  output: { filename: string };
  plugins: webpack.WebpackPluginInstance[];
  // Allow additional properties
  [key: string]: any;
}

export default function configureWebpack(
  options: WebpackOptions,
  webpackInstance: typeof webpack,
): WebpackOptions {
  let newEntry: string[];

  if (typeof options.entry === 'string') {
    newEntry = ['webpack/hot/poll?100', options.entry];
  } else if (Array.isArray(options.entry)) {
    newEntry = ['webpack/hot/poll?100', ...options.entry];
  } else {
    // Fallback if options.entry is not defined or of an unexpected type
    newEntry = ['webpack/hot/poll?100'];
  }
  return {
    ...options,
    entry: newEntry,
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpackInstance.HotModuleReplacementPlugin(),
      new webpackInstance.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        autoRestart: false,
      }),
    ],
  };
}

// export default function (options, webpack) {
//   return {
//     ...options,
//     entry: ['webpack/hot/poll?100', options.entry],
//     externals: [
//       nodeExternals({
//         allowlist: ['webpack/hot/poll?100'],
//       }),
//     ],
//     plugins: [
//       ...options.plugins,
//       new webpack.HotModuleReplacementPlugin(),
//       new webpack.WatchIgnorePlugin({
//         paths: [/\.js$/, /\.d\.ts$/],
//       }),
//       new RunScriptWebpackPlugin({
//         name: options.output.filename,
//         autoRestart: false,
//       }),
//     ],
//   };
// }

// import * as webpack from 'webpack';

//   return {
//     ...options,
//     entry: ['webpack/hot/poll?100', options.entry],
//     externals: [
//       nodeExternals({
//         allowlist: ['webpack/hot/poll?100'],
//       }) as any,
//     ],
//     plugins: [
//       ...options.plugins,
//       new wp.HotModuleReplacementPlugin(),
//       new wp.WatchIgnorePlugin({
//         paths: [/\.js$/, /\.d\.ts$/],
//       }),
//       new RunScriptWebpackPlugin({
//         name: options.output.filename,
//         autoRestart: false,
//       }),
//     ],
//   } as webpack.Configuration;
