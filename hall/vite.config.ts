// Build config for The Den, which is the whole website: every game is a lazy
// chunk of it. BASE_PATH lets one build serve from a GitHub Pages project
// path such as /woodgrain-88/.
//
// Ports are fixed so parallel sessions never collide: 4488 for the Hall's dev
// server, 5488 for the production preview that Playwright tests against.
import { defineConfig } from 'vite';
import { earlyAppearance } from './build/early-appearance.ts';
import { offlinePrecache } from './build/offline-precache.ts';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { port: 4488, strictPort: true },
  preview: { port: 5488, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    // Only the real site is built. harness.html (the test-only fake game) is
    // served by the dev server and never bundled.
    rolldownOptions: { input: 'index.html' },
  },
  plugins: [earlyAppearance(), offlinePrecache()],
});
