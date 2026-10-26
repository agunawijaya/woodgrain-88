/**
 * Entry point of the real site: fonts, styles, then the Hall.
 */
import '@fontsource-variable/fraunces/full';
import '@fontsource-variable/fraunces/full-italic';
import '@fontsource-variable/atkinson-hyperlegible-next/wght';
import '@fontsource-variable/big-shoulders-display/wght';
import '@fontsource/patrick-hand/400';
import './styles/tokens.css';
import './styles/base.css';
import './styles/den.css';
import './styles/chrome.css';
import './styles/pages.css';
import './styles/den-life.css';

import { boot } from './app/boot.ts';

async function start(root: HTMLElement): Promise<void> {
  // Dev only: ?showcase=full|mid|new boots on a generated profile. Production
  // builds drop this branch, and the showcase with it.
  if (import.meta.env.DEV) {
    const { showcaseFromUrl } = await import('./dev/showcase-boot.ts');
    const showcase = showcaseFromUrl(location.search, []);
    if (showcase) return boot(root, [], showcase);
  }
  boot(root);
}

const root = document.getElementById('app');
if (root) void start(root);

// Offline play after the first visit; only the built site has a worker to register.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
