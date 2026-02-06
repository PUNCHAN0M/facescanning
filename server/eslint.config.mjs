// @ts-check
import eslint from '@eslint/js';
import * as tsParser from '@typescript-eslint/parser';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import path from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    languageOptions: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      parser: tsParser,
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },

    // กำหนด plugins ที่ระดับสูงสุดของอ็อบเจกต์การตั้งค่า
    plugins: {
      'unused-imports': eslintPluginUnusedImports,
      'simple-import-sort': eslintPluginSimpleImportSort,
    },

    rules: {
      // ปิดกฎที่ซ้ำซ้อนหรือขัดแย้งกับ @typescript-eslint หรือ unused-imports
      'no-unused-vars': 'off',
      'no-console': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      //#region  //*=========== Unused Import ===========
      '@typescript-eslint/no-unused-vars': 'off', // ปิดกฎของ TS เพื่อให้ unused-imports จัดการแทน
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      //#endregion  //*======== Unused Import ===========

      //#region  //*=========== Import Sort ===========
      'simple-import-sort/exports': 'warn',
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            // 1. External libraries & side effects
            ['^@?\\w', '^\\u0000'],
            // 2. NestJS core (เช่น @nestjs/common, @nestjs/core)
            ['^@nestjs'],
            // 3. Config, constants, static data
            ['^@/config', '^@/constants', '^@/data'],
            // 4. Entities, DTOs, Types
            ['^@/entities', '^@/dtos', '^@/types'],
            // 5. Modules (NestJS modules)
            ['^@/modules'],
            // 6. Controllers
            ['^@/controllers'],
            // 7. Services
            ['^@/services'],
            // 8. Middlewares, Guards, Interceptors, Pipes
            ['^@/middlewares', '^@/guards', '^@/interceptors', '^@/pipes'],
            // 9. Utils, Libs, Helpers
            ['^@/utils', '^@/lib', '^@/helpers'],
            // 10. Stores, State management
            ['^@/store', '^@/state'],
            // 11. Other @ imports
            ['^@/'],
            // 12. Relative imports (up to 3 levels)
            [
              '^\\./?$',
              '^\\.(?!/?$)',
              '^\\.\\./?$',
              '^\\.\\.(?!/?$)',
              '^\\.\\./\\.\\./?$',
              '^\\.\\./\\.\\.(?!/?$)',
              '^\\.\\./\\.\\./\\.\\./?$',
              '^\\.\\./\\.\\./\\.\\.(?!/?$)',
            ],
            // 13. Other that didn't fit in
            ['^'],
          ],
        },
      ],
      //#endregion  //*======== Import Sort ===========

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  // ใช้ config ที่แนะนำจาก plugins ต่างๆ
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
);
