import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/dashboard/src/**/*.spec.ts'],
    environment: 'node',
  },
  resolve: {
    // Resolve TypeScript path aliases and bare .ts imports (no extension needed)
    extensions: ['.ts', '.js'],
  },
});
