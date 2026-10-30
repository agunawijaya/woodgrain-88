/**
 * Wireframe-with-a-look play: a whole duel or docking race, in any of the
 * four looks and any of the 17 cartridge variations, with each seat flown
 * by a person, a Neighbourhood Kid, or nobody. The bench for the art pass,
 * and the page the end-to-end tests drive. Dev only.
 *
 * ?look=deep|brass|paper|whirl  ?appearance=light|dark  ?variation=1..17
 * ?left= and ?right= person | kid:<id> | idle   (default: left a person, right Rosa)
 * ?scheme=classic|modern  ?target=10|5  ?switches=BB (left then right)
 * ?quality=high|medium|low  ?seed=<text>
 * Keys: seat 0 (orange) on the left of the keyboard, seat 1 (blue) on the arrows;
 * a lone player keeps the arrows. P pauses, R starts a fresh match.
 */
import type { Quality } from '@woodgrain-88/arena';
import {
  createInput,
  createRng,
  hashSeed,
  DEFAULT_BINDINGS,
  KID_IDS,
  type Appearance,
  type KidId,
  type SwitchPosition,
} from '@woodgrain-88/kit';
import { createKidPilot } from '../ai/pilot.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  IDLE,
  SHORT_MATCH_TICKS,
  TICKS_PER_SECOND,
  type MatchSetup,
  type Seat,
  type VariationRules,
} from '../engine/types.ts';
import { variation } from '../engine/variations.ts';
import type { CentreKind, LookId, SpaceView } from '../look/look.ts';
import { createLookStage, lookById } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';
import {
  classicBindings,
  createPlayerControls,
  LONE_PLAYER,
  modernBindings,
  PLAYER_FOR_SEAT,
  type ControlScheme,
} from '../session/controls.ts';
import {
  createMatchSession,
  type MatchSession,
  type SeatDriver,
} from '../session/match-session.ts';

const params = new URLSearchParams(location.search);
const LOOK_NAMES: readonly LookId[] = ['deep', 'brass', 'paper', 'whirl'];
const lookId: LookId = LOOK_NAMES.find((id) => id === params.get('look')) ?? 'deep';
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const variationNumber = Math.min(17, Math.max(1, Number(params.get('variation') ?? '1') || 1));
const scheme: ControlScheme = params.get('scheme') === 'modern' ? 'modern' : 'classic';
const target = Number(params.get('target') ?? '10') === 5 ? 5 : 10;
const quality = (params.get('quality') ?? 'high') as Quality;
const switchText = (params.get('switches') ?? 'BB').toUpperCase();
const switches: [SwitchPosition, SwitchPosition] = [
  switchText.startsWith('A') ? 'A' : 'B',
  switchText.charAt(1) === 'A' ? 'A' : 'B',
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

type Steering =
  | { readonly kind: 'person' }
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'idle' };

function steeringFrom(text: string | null, fallback: Steering): Steering {
  if (!text) return fallback;
  if (text === 'person' || text === 'idle') return { kind: text };
  const kid = KID_IDS.find((id) => `kid:${id}` === text);
  return kid ? { kind: 'kid', kid } : fallback;
}

const steering: [Steering, Steering] = [
  steeringFrom(params.get('left'), { kind: 'person' }),
  steeringFrom(params.get('right'), { kind: 'kid', kid: 'rosa' }),
];

function centreKindOf(rules: VariationRules): CentreKind {
  return rules.centre === 'none' ? null : rules.centre;
}

function main(): void {
  const host = document.getElementById('stage');
  if (!host) throw new Error('play page needs #stage');
  const look = lookById(lookId);
  // Kept for screenshots: the bench is what the end-to-end shots and the lead's critiques capture.
  const stage = createLookStage({ host, look, appearance, quality, preserveDrawingBuffer: true });
  const people = steering.filter((entry) => entry.kind === 'person').length;
  const input = createInput({
    layout: people === 2 ? 'split' : 'solo',
    bindings:
      scheme === 'modern' ? modernBindings(DEFAULT_BINDINGS) : classicBindings(DEFAULT_BINDINGS),
  });
  const playerControls = createPlayerControls(input);
  const hud = createHud(host);
  let session: MatchSession | null = null;
  let shown: SpaceView | null = null;
  let paused = false;
  let round = 0;

  function driverFor(seat: Seat, entry: Steering, seed: string): SeatDriver {
    if (entry.kind === 'person') {
      const player = people === 2 ? PLAYER_FOR_SEAT[seat] : LONE_PLAYER;
      return playerControls.driver(seat, player, scheme);
    }
    if (entry.kind === 'kid') {
      return createKidPilot({ kid: entry.kid, seat, mode: 'human', seed: `${seed}/${seat}` });
    }
    return { controls: () => IDLE };
  }

  function start(): void {
    session?.dispose();
    // Only the old view leaves the scene: the stage's own lights live there too.
    if (shown) stage.scene.remove(shown.root);
    round += 1;
    const seed = params.get('seed') ?? `play/${round}`;
    const rules = variation(variationNumber);
    const view = look.createView({
      stage,
      appearance,
      quality,
      rng: createRng(`play/${seed}`),
      seats: seatColours(),
      centre: centreKindOf(rules),
      edges: rules.edges,
      pods: rules.pods,
      reducedEffects: reducedMotion,
    });
    stage.scene.add(view.root);
    shown = view;
    const setup: MatchSetup = {
      rules,
      switches,
      target,
      clockTicks: target === 5 ? SHORT_MATCH_TICKS : CARTRIDGE_MATCH_TICKS,
      seed: hashSeed(seed),
    };
    session = createMatchSession({
      setup,
      drivers: [driverFor(0, steering[0], seed), driverFor(1, steering[1], seed)],
      view,
      reducedMotion,
      onEvent: () => hud.update(session),
    });
    hud.update(session);
  }

  addEventListener('keydown', (event) => {
    if (event.code === 'KeyP') paused = !paused;
    if (event.code === 'KeyR') start();
  });

  start();
  let last = performance.now();
  const frame = (now: number) => {
    // An animation frame's timestamp can come slightly before the clock read at start-up.
    const seconds = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (!paused) session?.advance(seconds);
    // The stage's light rig fades its flashes (a hit, a dock) by real time.
    stage.lights.update(seconds);
    stage.render();
    hud.update(session);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  (window as Window & { __gravityDuel?: unknown }).__gravityDuel = {
    get match() {
      return session?.match;
    },
    get session() {
      return session;
    },
    stage,
  };
  document.body.dataset.ready = 'true';
}

/** A plain text strip over the arena: scores, fuel and ammo as numbers, and the clock. */
function createHud(host: HTMLElement): { update(session: MatchSession | null): void } {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;top:12px;left:50%;transform:translateX(-50%);font:600 18px system-ui;' +
    'color:#fff;background:rgba(0,0,0,.55);padding:6px 16px;border-radius:10px;white-space:pre';
  host.append(box);
  return {
    update(session) {
      if (!session) {
        box.textContent = '';
        return;
      }
      const match = session.match;
      const duel = match.setup.rules.mode === 'duel';
      const seconds = Math.ceil(match.clockLeft / TICKS_PER_SECOND);
      const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      const resources = (seat: Seat): string =>
        duel ? ` fuel ${match.ships[seat].fuel} ammo ${match.ships[seat].ammo}` : '';
      box.textContent =
        `${match.ships[0].score}${resources(0)}  –  ${match.ships[1].score}${resources(1)}   ${clock}` +
        (session.over ? '  ·  over (R)' : '');
    },
  };
}

try {
  main();
} catch (error: unknown) {
  document.body.dataset.error = String(error);
  console.error(error);
}
