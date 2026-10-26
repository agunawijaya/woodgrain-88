/**
 * Entry point of the dev-only harness (harness.html): the real Hall with the
 * test-only fixtures swapped into their slots: paddles 11, grid 20, and the
 * catch game five times over in 26–30, so a Power Cycle Run has five games.
 * `?showcase=full|mid|new` works here too. Never part of the build.
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

import { fakeGame, fakeManifest, turnGame, turnManifest, virtualRunGames } from '../tests/fixtures/index.ts';
import { boot } from './app/boot.ts';
import { showcaseFromUrl } from './dev/showcase-boot.ts';

const entries = [
  { manifest: fakeManifest, load: () => Promise.resolve(fakeGame) },
  { manifest: turnManifest, load: () => Promise.resolve(turnGame) },
  ...virtualRunGames().map((game) => game.entry),
];

const root = document.getElementById('app');
if (root) boot(root, entries, showcaseFromUrl(location.search, entries) ?? undefined);
