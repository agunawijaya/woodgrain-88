/**
 * Wireframe play: a whole match in any look and any of the 14 cartridge
 * variations, with each rider steered by a person, a Neighbourhood Kid, the
 * cartridge's own computer, or nobody. It is the bench for checking rules,
 * controls and feel before the menus exist, and the page the end-to-end
 * tests drive. Dev only.
 *
 * ?look=neon|trains|mummy|ice  ?appearance=light|dark  ?variation=1..14
 * ?left= and ?right= person | kid:<id> | computer | idle   (default: left a person, right Rosa)
 * ?target=10|5  ?switches=BB (left then right)  ?quality=high|medium|low  ?seed=<text>
 * ?camera=chase follows a lone person's rider instead of showing the whole board.
 * ?riders=4 plays Four Way: the two riders as above, and Lou and Dee in the other corners.
 * Keys: the left rider on WASD (Q E Z C) and Space, the right rider on the arrows (keypad) and Enter;
 * P pauses, R starts a fresh match.
 */
import type { Quality } from '@woodgrain-88/arena';
import {
  createInput,
  createRng,
  KID_IDS,
  withDiagonalKeys,
  DEFAULT_BINDINGS,
  type Appearance,
  type KidId,
  type SwitchPosition,
} from '@woodgrain-88/kit';
import { createComputer1977, lookaheadFor } from '../ai/computer-1977.ts';
import { createKidRider } from '../ai/kid.ts';
import { variationRules } from '../engine/variations.ts';
import { IDLE, type MatchSetup, type StepPilot } from '../engine/types.ts';
import type { LookId } from '../look/look.ts';
import { createChaseCamera, type ChaseCamera } from '../look/chase-camera.ts';
import { createLookStage, lookById } from '../look/looks.ts';
import { fourWayColours, seatColours } from '../look/seats.ts';
import { createPlayerControls, LONE_PLAYER_RIDER, PLAYER_FOR_RIDER } from '../session/controls.ts';
import {
  createMatchSession,
  type MatchSession,
  type SeatDriver,
  type SessionEvent,
} from '../session/match-session.ts';

const params = new URLSearchParams(location.search);
const LOOK_NAMES: readonly LookId[] = ['neon', 'trains', 'mummy', 'ice'];
const lookId: LookId = LOOK_NAMES.find((id) => id === params.get('look')) ?? 'neon';
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const variation = Math.min(14, Math.max(1, Number(params.get('variation') ?? '1') || 1));
const target = Number(params.get('target') ?? '10') === 5 ? 5 : 10;
const quality = (params.get('quality') ?? 'high') as Quality;
const switchText = (params.get('switches') ?? 'BB').toUpperCase();
const switches: [SwitchPosition, SwitchPosition] = [
  switchText.startsWith('A') ? 'A' : 'B',
  switchText.charAt(1) === 'A' ? 'A' : 'B',
];

type Steering =
  | { readonly kind: 'person' }
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'computer' }
  | { readonly kind: 'idle' };

function steeringFrom(text: string | null, fallback: Steering): Steering {
  if (!text) return fallback;
  if (text === 'person' || text === 'computer' || text === 'idle') return { kind: text };
  const kid = KID_IDS.find((id) => `kid:${id}` === text);
  return kid ? { kind: 'kid', kid } : fallback;
}

const steering: [Steering, Steering] = [
  steeringFrom(params.get('left'), { kind: 'person' }),
  steeringFrom(params.get('right'), { kind: 'kid', kid: 'rosa' }),
];

const IDLE_DRIVER: SeatDriver = { stick: () => IDLE };
/** The two riders the page's own options steer; Four Way adds Kids in the other corners. */
const DUEL = [0, 1] as const;
const fourWay = params.get('riders') === '4';
const CORNER_KIDS: readonly KidId[] = ['lou', 'dee'];

function main(): void {
  const host = document.getElementById('stage');
  if (!host) throw new Error('play page needs #stage');
  const look = lookById(lookId);
  const stage = createLookStage({ host, look, appearance, quality });
  const people = steering.filter((entry) => entry.kind === 'person').length;
  const input = createInput({
    layout: people === 2 ? 'split' : 'solo',
    bindings: withDiagonalKeys(DEFAULT_BINDINGS),
  });
  const controls = createPlayerControls(input);
  const hud = createHud(host);
  let session: MatchSession | null = null;
  let chase: ChaseCamera | null = null;
  let paused = false;
  let round = 0;

  function driverFor(seat: 0 | 1, entry: Steering, seed: string): SeatDriver {
    if (entry.kind === 'person') {
      // A lone player keeps the arrows whichever rider they ride; two share the keyboard.
      return controls.driver(
        people === 2 ? PLAYER_FOR_RIDER[seat] : PLAYER_FOR_RIDER[LONE_PLAYER_RIDER],
      );
    }
    if (entry.kind === 'kid')
      return createKidRider({ kid: entry.kid, seat, mode: 'human', seed: `${seed}/${seat}` });
    return IDLE_DRIVER;
  }

  function start(): void {
    session?.dispose();
    stage.scene.clear();
    round++;
    const seed = params.get('seed') ?? `play/${round}`;
    const view = look.createView({
      stage,
      appearance,
      quality,
      rng: createRng(`play/${seed}`),
      seats: fourWay ? fourWayColours() : seatColours(),
      players: fourWay ? 4 : 2,
      reducedEffects: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    stage.scene.add(view.root);
    chase?.release();
    chase = null;
    const personSeat = DUEL.find((seat) => steering[seat].kind === 'person');
    if (params.get('camera') === 'chase' && people === 1 && personSeat !== undefined) {
      chase = createChaseCamera(stage, () => view, look.framing, personSeat);
    }
    const pilots = DUEL.map((seat): StepPilot | null =>
      steering[seat].kind === 'computer' ? createComputer1977(lookaheadFor(switches[0])) : null,
    );
    const setup: MatchSetup = {
      rules: variationRules(variation),
      players: fourWay ? 4 : 2,
      switches: fourWay ? [...switches, 'B', 'B'] : switches,
      target,
      pilots: fourWay ? [...pilots, null, null] : pilots,
    };
    const corners = fourWay
      ? CORNER_KIDS.map((kid, index) =>
          createKidRider({ kid, seat: index === 0 ? 2 : 3, mode: 'human', seed: `${seed}/${kid}` }),
        )
      : [];
    session = createMatchSession({
      setup,
      drivers: [driverFor(0, steering[0], seed), driverFor(1, steering[1], seed), ...corners],
      view,
      onEvent: (event) => hud.show(event, session),
    });
    hud.reset();
  }

  addEventListener('keydown', (event) => {
    if (event.code === 'KeyP') paused = !paused;
    if (event.code === 'KeyR') start();
  });

  start();
  let last = performance.now();
  const frame = (now: number) => {
    const seconds = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) session?.advance(seconds);
    chase?.update(paused ? 0 : seconds);
    stage.render();
    document.body.dataset.ticks = String(session?.match.tick ?? 0);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.body.dataset.ready = 'true';
}

/** A plain score line and speed readout over the arena: the wireframe stand-in for the real HUD. */
function createHud(host: HTMLElement) {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;top:12px;left:50%;transform:translateX(-50%);font:700 28px system-ui;color:#fff;' +
    'background:rgba(0,0,0,.55);padding:6px 18px;border-radius:12px;letter-spacing:.06em';
  host.append(box);
  const [left, right] = seatColours();
  let speed = 0;
  return {
    reset() {
      speed = 0;
      box.innerHTML = `<span style="color:${left.main}">0</span> – <span style="color:${right.main}">0</span>`;
    },
    show(event: SessionEvent, session: MatchSession | null) {
      if (event.type === 'speed') speed = event.stage;
      if (!session) return;
      const [a = 0, b = 0] = session.match.riders.map((rider) => rider.score);
      const over = session.over ? ' · over' : '';
      box.innerHTML =
        `<span style="color:${left.main}">${String(a)}</span> – <span style="color:${right.main}">${String(b)}</span>` +
        `<span style="font-size:16px;opacity:.8"> · speed ${speed + 1}${over}</span>`;
    },
  };
}

try {
  main();
} catch (error: unknown) {
  document.body.dataset.error = String(error);
  console.error(error);
}
