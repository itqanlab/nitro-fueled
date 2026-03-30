import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    // Allow TypeScript to resolve .js extensions to .ts sources
    extensions: ['.ts', '.js'],
  },
});
