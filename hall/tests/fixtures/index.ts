/**
 * Export catalog of test-only game fixtures for Den Life and Power Cycle Run.
 * These fixtures enable end-to-end integration testing of all platform contract
 * facets before production games ship.
 */
import type { GameEntry, GameModule } from '@woodgrain-88/kit';
import { CATCH_GAME_ID, catchGame, catchManifest } from './catch-game.ts';
import { FAKE_GAME_ID, fakeGame, fakeManifest } from './fake-game.ts';
import { TURN_GAME_ID, turnGame, turnManifest } from './turn-game.ts';

export { fakeGame, fakeManifest, FAKE_GAME_ID } from './fake-game.ts';
export { turnGame, turnManifest, TURN_GAME_ID } from './turn-game.ts';
export { catchGame, catchManifest, CATCH_GAME_ID } from './catch-game.ts';

/** The three fixtures as registry overrides, each loading its module. */
export const FIXTURE_ENTRIES: readonly GameEntry[] = [
  { manifest: fakeManifest, load: () => Promise.resolve(fakeGame) },
  { manifest: turnManifest, load: () => Promise.resolve(turnGame) },
  { manifest: catchManifest, load: () => Promise.resolve(catchGame) },
];

/** Five catch games under ids test-catch-1 … test-catch-5 (slots 26–30), so a Power Cycle Run has five candidates. */
export function virtualRunGames(): { entry: GameEntry; module: GameModule }[] {
  return Array.from({ length: 5 }, (_, index) => {
    const num = index + 1;
    const slot = 25 + num;
    const id = `test-catch-${num}`;
    const title = `Test Catch ${num}`;

    const manifest = {
      ...catchManifest,
      id,
      slot,
      title,
      inspiredBy: {
        ...catchManifest.inspiredBy,
        cartridgeSlots: [slot],
      },
    };

    const module: GameModule = { ...catchGame, manifest };

    const entry: GameEntry = {
      manifest,
      load: () => Promise.resolve(module),
    };

    return { entry, module };
  });
}

/** Every fixture id, for the build check that keeps them out of the site. */
export const FIXTURE_IDS: readonly string[] = [
  FAKE_GAME_ID,
  TURN_GAME_ID,
  CATCH_GAME_ID,
  'test-catch-1',
  'test-catch-2',
  'test-catch-3',
  'test-catch-4',
  'test-catch-5',
];
