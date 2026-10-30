// End-to-end tests for Gravity Duel on its own dev server (port 5523), through
// the game harness (game.html): the real module mounted with a faithful fake
// of the Hall's context and chrome. `pnpm --filter @woodgrain-88/gravity-duel e2e`.
//
// - flows: menus and matches by keyboard, every way to start a run, pause, results.
// - shots: the screenshots in docs/media/screens, only with SHOTS=1.
//
// The game is WebGL throughout, so the browser gets the real GPU where it can
// (Direct3D on Windows) and falls back to software elsewhere.
import { defineConfig, devices } from '@playwright/test';

const GL = [
  '--ignore-gpu-blocklist',
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
];
// Headless machines have no sound card; a fake output keeps WebAudio quiet.
const NO_SOUND_CARD = ['--disable-audio-output'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 180_000,
  use: {
    baseURL: 'http://localhost:5523',
    trace: 'retain-on-failure',
    acceptDownloads: true,
    launchOptions: { args: [...GL, ...NO_SOUND_CARD] },
  },
  projects: [
    {
      name: 'flows',
      testMatch: /flows\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'shots',
      testMatch: /shots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5523 --strictPort',
    url: 'http://localhost:5523/game.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
