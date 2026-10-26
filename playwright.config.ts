// End-to-end tests for the Hall.
//
// - site: the production build served by `vite preview` on 5488, exactly as
//   players get it: day and night, the power switch, keyboard paths, list
//   view, intro, browser Back, export and import, axe, no network requests.
// - harness: the dev server on 4488 serving hall/harness.html, the only page
//   where the test-only fake game exists. It proves the play → pause →
//   results → back loop, events, a channel and a challenge link through the
//   real chrome.
// - frames: frame time in the Den at 1920×1080, run last and alone so no other
//   browser competes for the CPU, on the GPU when the machine has one.
//
// If the browsers live outside the default folder, point
// PLAYWRIGHT_BROWSERS_PATH at them before running.
import { defineConfig, devices } from '@playwright/test';

const SITE_URL = 'http://localhost:5488';
const DEV_URL = 'http://localhost:4488';
const desktop = { viewport: { width: 1280, height: 720 } };
// Every page runs the WebGL picture tube; on the software renderer each browser
// costs a core or two, so a handful of workers keeps the timings honest.
const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// Headless Chromium picks the software renderer unless told otherwise; on
// Windows Direct3D reaches the real GPU, elsewhere it falls back by itself.
const HARDWARE_GL = [
  '--ignore-gpu-blocklist',
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
];
// Headless machines have no sound card; a fake output keeps WebAudio quiet.
const NO_SOUND_CARD = ['--disable-audio-output'];

export default defineConfig({
  testDir: './hall/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
    // The offline worker would carry its cache from one test into the next.
    serviceWorkers: 'block',
    launchOptions: { args: [...SOFTWARE_GL, ...NO_SOUND_CARD] },
  },
  projects: [
    {
      name: 'site',
      testMatch: /site\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...desktop, baseURL: SITE_URL },
    },
    {
      name: 'harness',
      testMatch: /harness\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...desktop, baseURL: DEV_URL },
    },
    {
      name: 'frames',
      testMatch: /frames\/.*\.spec\.ts/,
      dependencies: ['site', 'harness'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: SITE_URL,
        launchOptions: { args: [...HARDWARE_GL, ...NO_SOUND_CARD] },
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @woodgrain-88/hall exec vite preview --port 5488 --strictPort',
      url: SITE_URL,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @woodgrain-88/hall exec vite --port 4488 --strictPort',
      url: `${DEV_URL}/harness.html`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
