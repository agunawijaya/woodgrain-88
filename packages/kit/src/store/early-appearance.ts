/**
 * The before-paint script: a few lines inlined into the page head so the
 * very first frame is already drawn by day or by night and never flashes the
 * wrong one. It lives with the store because it reads saved settings, and the
 * store is the only code allowed to touch storage.
 */
import { STORE_NAMESPACE } from './local-store.ts';

export function earlyAppearanceScript(): string {
  return `(function () {
  var appearance = 'system';
  var motion = 'system';
  try {
    var saved = JSON.parse(localStorage.getItem('${STORE_NAMESPACE}:settings') || 'null');
    if (saved && saved.data) {
      appearance = saved.data.appearance || appearance;
      motion = saved.data.reducedMotion || motion;
    }
  } catch (error) {}
  var dark = appearance === 'dark' || (appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  var reduced = motion === 'on' || (motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
  document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
})();`;
}
