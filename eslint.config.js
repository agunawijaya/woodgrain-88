// Lint rules for the whole workspace. The type-aware presets catch the bugs
// that hurt real-time games most (floating promises, unsafe `any`, impossible
// branches). Prettier owns layout, so rules that would argue with it are off.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'test-results/**',
      'playwright-report/**',
      'prompts/**',
      '.claude/**',
      // The owner's reference folders and private research are never linted or published.
      'original/**',
      'src/**',
      'research/**',
      '.team/runs/**',
      '.team/worktrees/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `!` is forbidden (no-non-null-assertion), so this stylistic rule could only conflict.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // DOM calls such as `classList.toggle` return values we have no use for.
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    files: [
      'scripts/**',
      '*.config.ts',
      '*.config.js',
      'hall/*.config.ts',
      'hall/build/**',
      'tools/**',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The crew bridge is plain dependency-free ESM so it runs before `pnpm install`.
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
