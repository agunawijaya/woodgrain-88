// The game's own dev server, for the hero scenes and the wireframe harness.
// Ports are fixed per game so parallel sessions never collide: 4520 here,
// 5520 for this game's Playwright preview.
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 4520, strictPort: true },
  preview: { port: 5520, strictPort: true },
});
