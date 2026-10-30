/**
 * The game's screens over a live Kids' duel, with made-up data, to look at
 * them before the controller wires them in. Dev only.
 * ?screen=menu  ?appearance=light|dark  ?look=deep|brass|paper|whirl
 */
import type { LookId } from '../look/look.ts';
import { createGravityDuelDemo } from '../demo/demo.ts';
import { createMenuScreen } from '../screens/menu.ts';

const params = new URLSearchParams(location.search);
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const look = (params.get('look') ?? 'deep') as LookId;

function main(): void {
  const stageHost = document.getElementById('stage');
  const screens = document.getElementById('screens');
  if (!stageHost || !screens) throw new Error('screens page needs #stage and #screens');
  screens.dataset.appearance = appearance;
  createGravityDuelDemo(stageHost, 3, {
    appearance,
    reducedMotion: false,
    width: innerWidth,
    height: innerHeight,
  });
  const menu = createMenuScreen({
    host: screens,
    mode: 'duel',
    channelId: 'game-4',
    opponent: 'rosa',
    look,
    scheme: 'classic',
    matchLength: 10,
    switches: ['B', 'B'],
    isUnlocked: () => true,
    onMode: () => undefined,
    onChannel: () => undefined,
    onOpponent: () => undefined,
    onLook: () => undefined,
    onScheme: () => undefined,
    onMatchLength: () => undefined,
    onStart: () => undefined,
    onHowToPlay: () => undefined,
    onSettings: () => undefined,
    onRecords: () => undefined,
    onBackToHall: () => undefined,
  });
  menu.show();
  document.body.dataset.ready = 'true';
}

main();
