import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    clearMocks: true,
  },
  lint: {
    ignorePatterns: ['dist/**', 'data/**', 'node_modules/**', '*.js', '*.d.ts'],
    options: { typeAware: true },
  },
  fmt: {
    singleQuote: true,
    semi: true,
    printWidth: 100,
    trailingComma: 'all',
  },
});
