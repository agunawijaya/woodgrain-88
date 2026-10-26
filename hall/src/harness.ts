/**
 * Entry point of the dev-only harness (harness.html): the real Hall with the
 * test-only fake game swapped into slot 11. Never part of the build.
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

import { fakeGame, fakeManifest } from '../tests/fixtures/fake-game.ts';
import { boot } from './app/boot.ts';

const root = document.getElementById('app');
if (root) boot(root, [{ manifest: fakeManifest, load: () => Promise.resolve(fakeGame) }]);
