/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  // Runs the Angular compiler over sources under test.
  //
  // Without it, specs get a plain TypeScript transform and TestBed falls back to
  // JIT, which can only see inputs and outputs declared with decorators. The
  // initializer-based APIs — input(), output(), viewChild(), model() — need the
  // compiler to register them on the component definition, so under a bare
  // transform they bind to nothing: inputs keep their default value and outputs
  // never fire, with no error to show why.
  plugins: [angular({ tsconfig: './tsconfig.spec.json' })],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
});
