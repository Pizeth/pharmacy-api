interface ImportMetaEnv {
  [x: string]: string;
  MODE: string;
  // Add other env variables if needed
  readonly VITE_API_URL: string; // For example, add your environment variables here.
  // add other variables as needed, e.g.:
  // readonly VITE_ANOTHER_VAR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
