import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import * as oxcParser from 'eslint-parser-oxc';

export default defineConfig([
  globalIgnores(['dist/', 'out/']),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: oxcParser,
    },
    rules: {
      // TypeScript resolves type names and checks parameters in executable code.
      // ESLint would also report parameter names in type-only signatures.
      'no-undef': 'off',
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
]);
