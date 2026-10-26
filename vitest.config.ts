// `pnpm test` runs every workspace project at once: the kit, the Hall, the
// repo scripts and each game. Each project keeps its own vitest.config.ts so
// it can pick its own environment (Node for engines, happy-dom for the DOM).
// The crew bridge has its own dependency-free tests (`pnpm test:crew`).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'hall', 'scripts/vitest.config.ts', 'games/*/vitest.config.ts'],
  },
});
