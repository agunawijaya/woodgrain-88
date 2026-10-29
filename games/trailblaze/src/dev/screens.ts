/**
 * The game's screens over a live Kids' duel, with made-up data, to look at
 * them before the controller wires them in. Dev only.
 * ?screen=menu  ?appearance=light|dark  ?look=neon|trains|mummy|ice
 */
import type { LookId } from '../look/look.ts';
import { createTrailblazeDemo } from '../demo/demo.ts';
import { createMenuScreen } from '../screens/menu.ts';

const params = new URLSearchParams(location.search);
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const look = (params.get('look') ?? 'neon') as LookId;

function main(): void {
  const stageHost = document.getElementById('stage');
  const screens = document.getElementById('screens');
  if (!stageHost || !screens) throw new Error('screens page needs #stage and #screens');
  screens.dataset.appearance = appearance;
  createTrailblazeDemo(stageHost, 3, {
    appearance,
    reducedMotion: false,
    width: innerWidth,
    height: innerHeight,
  });
  const menu = createMenuScreen({ host: screens, channelId: 'game-3', opponent: 'rosa', look });
  menu.show();
  document.body.dataset.ready = 'true';
}

main();
