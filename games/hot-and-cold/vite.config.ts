// The game's own dev server, for the hero scenes and, later, the play harness.
// Ports are fixed per game so parallel sessions never collide: 4521 here,
// 5521 for this game's Playwright preview.
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 4521, strictPort: true },
  preview: { port: 5521, strictPort: true },
});
