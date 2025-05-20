// export interface HotModule {
//   hot?: {
//     accept: () => void;
//     dispose: (callback: () => void) => void;
//   };
// }

export interface WebpackHotModule {
  accept(callback?: (err?: any) => void): void;
  //   dispose(callback: () => void): void;
  dispose(callback: () => void | Promise<void>): void;
}

export interface HotModule extends NodeJS.Module {
  hot?: WebpackHotModule;
}

// declare const module: HotModule;
