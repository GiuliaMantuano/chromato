import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/regression/**/*.test.ts'],
    deps: {
      // Inline ink so its exports are writable (enables vi.spyOn on ink.render).
      // Ink 4.x is pure ESM; without inlining, ESM export properties are non-configurable.
      inline: ['ink'],
    },
    exclude: ['tests/acceptance/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
