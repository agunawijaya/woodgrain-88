// The game's own dev server, for the hero scenes and, later, the play harness.
// Ports are fixed per game so parallel sessions never collide: 4523 here,
// 5523 for this game's Playwright preview.
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 4523, strictPort: true },
  preview: { port: 5523, strictPort: true },
});
