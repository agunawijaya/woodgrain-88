// Inlines the kit's before-paint script into the page head, so the first
// frame is already drawn by day or by night.
import type { Plugin } from 'vite';
import { earlyAppearanceScript } from '../../packages/kit/src/store/early-appearance.ts';

export function earlyAppearance(): Plugin {
  return {
    name: 'woodgrain-88:early-appearance',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'script', children: earlyAppearanceScript(), injectTo: 'head-prepend' },
      ],
    },
  };
}
