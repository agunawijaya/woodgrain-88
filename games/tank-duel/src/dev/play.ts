/**
 * Wireframe play: the real engine, renderer and HUD on the game's own dev
 * server, before the game is wired into the Hall. Two seats on one keyboard
 * (WASD + Space, arrows + Enter) or gamepads. Dev only; never part of a build.
 *
 * ?channel=game-6  ?appearance=light|dark  ?scoring=timed|first-to-10  ?wiring=1
 */
import { createStage } from '@woodgrain-88/arena';
import { createInput, createLoop, createRng, type Appearance } from '@woodgrain-88/kit';
import { Color } from 'three';
import { channelById } from '../engine/channels.ts';
import { createMatch, createWorld, stepMatch } from '../engine/match.ts';
import type { MatchState, ScoringRule } from '../engine/types.ts';
import { isRevealed } from '../engine/visibility.ts';
import type { Vec2 } from '../engine/vec.ts';
import { toTable } from '../render/board.ts';
import { createMatchView } from '../render/match-view.ts';
import { FLYING_HEIGHT } from '../render/sky.ts';
import { stickFromFrame } from '../session/match-session.ts';
import { createHud } from '../ui/hud.ts';

const params = new URLSearchParams(location.search);
const channel = channelById(params.get('channel') ?? 'game-1');
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const scoring: ScoringRule = params.get('scoring') === 'first-to-10' ? 'first-to-10' : 'timed';

const host = document.getElementById('stage');
if (!host) throw new Error('play page needs #stage');
const inTheAir = channel.field.kind === 'sky';
const stage = createStage({
  host,
  appearance,
  quality: 'high',
  framing: inTheAir
    ? {
        width: 64,
        depth: 40,
        tilt: 55,
        height: 3,
        margin: 0,
        topInset: 0.085,
        elevation: FLYING_HEIGHT,
      }
    : { width: 65.2, depth: 42.4, tilt: 55, height: 2, margin: 0.004, topInset: 0.085 },
});
stage.scene.background = new Color(appearance === 'dark' ? '#07080c' : '#3b2a1e');

const world = createWorld(channel);
const options = {
  scoring,
  handicap: [false, false] as const,
  wiring: params.get('wiring') === '1',
};
let previous: MatchState = createMatch(channel, options, world);
let current = previous;
const rng = createRng(`play/${channel.id}/${Date.now()}`);
const view = createMatchView({
  stage,
  channel,
  field: world.field,
  night: appearance === 'dark',
  rng: rng.fork('view'),
  revealed: isRevealed,
  reducedEffects: false,
});
const hud = createHud({
  host,
  seats: [
    { name: 'Player 1', note: 'WASD · Space' },
    { name: 'Player 2', note: 'Arrows · Enter' },
  ],
  scoring,
  appearance,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
});
const input = createInput({ layout: 'split' });

/** Raises the HUD's bank tag over the point on the board where the banked shell struck. */
function showBank(at: Vec2, bounces: number): void {
  const point = toTable(at.x, at.y, (inTheAir ? FLYING_HEIGHT : 0) + 1.5).project(stage.camera);
  const box = host?.getBoundingClientRect();
  if (!box) return;
  hud.bank(((point.x + 1) / 2) * box.width, ((1 - point.y) / 2) * box.height, bounces);
}

let frameStarted = performance.now();
const loop = createLoop({
  update(dt) {
    const frame = input.poll();
    const step = stepMatch(
      current,
      [stickFromFrame(frame.seats[1]), stickFromFrame(frame.seats[2])],
      dt,
      world,
    );
    previous = current;
    current = step.state;
    view.applyEvents(current, step.events);
    for (const event of step.events) {
      if (event.kind === 'hit' && event.bounces > 0) showBank(event.at, event.bounces);
    }
  },
  render(alpha) {
    const now = performance.now();
    const seconds = Math.min(0.1, (now - frameStarted) / 1000);
    frameStarted = now;
    view.draw(previous, current, alpha, seconds);
    hud.update(current);
    stage.render();
  },
});
loop.start();
