// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // {
  //   ignores: [
  //     'eslint.config.mjs',
  //     'dist/**/*',
  //     'coverage/**/*',
  //     'src/generated/prisma/client/**/*', // Completely blocks your generated client files
  //   ],
  // },
  // 1. THIS IS THE FIX: Explicitly forces ESLint to throw away this directory globally
  globalIgnores([
    'eslint.config.mjs',
    'dist/**/*',
    'coverage/**/*',
    '**/src/generated/prisma/client/**/*',
    'prisma/**/*',
    'scripts/**/*',
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      // sourceType: 'commonjs',
      parserOptions: {
        // projectService: true,
        projectService: {
          allowDefaultProject: [],
        },
        // project: ['./tsconfig.json', './tsconfig.scripts.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      'prettier/prettier': [
        'error',
        { singleQuote: true, jsxSingleQuote: true },
      ],
    },
  },
  // ==========================================
  // FORCE OVERRIDE: Place this block LAST
  // This explicitly isolates your generated code and prevents Prettier checks
  // ==========================================
  {
    files: ['**/src/generated/prisma/client/**/*'],
    rules: {
      'prettier/prettier': 'off',
    },
  },
);
