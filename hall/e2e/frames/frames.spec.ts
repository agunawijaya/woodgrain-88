/**
 * Frame time in the Den at 1920×1080, measured alone after the other suites so
 * no other browser competes for the CPU.
 *
 * Two numbers: the median requestAnimationFrame interval (capped by the
 * display, so 16.7 ms means a steady 60 fps) and the main thread's busy time
 * per frame from the DevTools performance counters, which shows the headroom
 * below that cap. On a software renderer (SwiftShader, as on CI runners) the
 * GPU work lands on the CPU, so the numbers are reported but not held to a
 * budget.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

const SAMPLE_MS = 5000;
const SIXTY_FPS_MEDIAN_MS = 1000 / 55;
const MAIN_THREAD_BUDGET_MS = 8;

test.use({ viewport: { width: 1920, height: 1080 } });

test('the Den holds 60 fps at 1920×1080 with main-thread headroom', async ({ page }) => {
  const errors = collectErrors(page);
  await skipIntro(page);
  await page.goto('/');
  await expect(page.locator('.den')).toBeVisible();
  // Let the warm-up and the first demo settle before sampling.
  await page.waitForTimeout(1500);

  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'no WebGL';
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const taskSeconds = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0;
  };

  const busyBefore = await taskSeconds();
  const intervals = await page.evaluate(
    (sampleMs) =>
      new Promise<number[]>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const onFrame = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - start >= sampleMs) resolve(deltas);
          else requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);
      }),
    SAMPLE_MS,
  );
  const busyAfter = await taskSeconds();

  const sorted = [...intervals].sort((a, b) => a - b);
  const at = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
  const median = at(0.5);
  const p95 = at(0.95);
  const busyPerFrame = ((busyAfter - busyBefore) * 1000) / intervals.length;
  const software = /swiftshader/i.test(renderer);

  const summary = `renderer: ${renderer}; frames: ${intervals.length}; median interval ${median.toFixed(1)} ms; p95 ${p95.toFixed(1)} ms; main thread ${busyPerFrame.toFixed(2)} ms per frame`;
  test.info().annotations.push({ type: 'frame time', description: summary });
  console.warn(summary);

  if (!software) {
    expect(median).toBeLessThan(SIXTY_FPS_MEDIAN_MS);
    expect(busyPerFrame).toBeLessThan(MAIN_THREAD_BUDGET_MS);
  }
  expect(errors).toEqual([]);
});
