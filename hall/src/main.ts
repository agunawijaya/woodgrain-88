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

import { boot } from './app/boot.ts';

const root = document.getElementById('app');
if (root) boot(root);

// Offline play after the first visit; only the built site has a worker to register.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
