import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/vitest.setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/regression/**/*.test.ts',
    ],
    server: {
      deps: {
        // Inline ink so its exports are writable (enables vi.spyOn on ink.render —
        // see tuiAdapter.test.ts). Ink 4.x is pure ESM; without inlining, ESM export
        // properties are non-configurable. (vitest 4 moved this from deps.inline to server.deps.inline.)
        inline: ['ink'],
      },
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
