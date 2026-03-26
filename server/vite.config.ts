import { defineConfig } from 'vite-plus';

export default defineConfig({
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
