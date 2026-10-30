/**
 * Wireframe play: the engine drawn as plain lines on a canvas, any of the 17
 * variations, each seat flown by a person, a Neighbourhood Kid or nobody. It
 * is the bench for feeling the physics and watching the Kids before the looks
 * are wired in. Dev only.
 *
 * ?variation=1..17  ?left= and ?right= person | kid:<id> | idle (default: left a person, right Rosa)
 * ?target=10|5  ?switches=BB  ?seed=<text>  ?speed=1..8 (ticks per frame, for watching Kids)
 * Keys: left seat A/D turn, W thrust, S cloak, Space fire; right seat arrows and Enter.
 * P pauses, R starts a fresh match.
 */
import { hashSeed, KID_IDS, type KidId, type SwitchPosition } from '@woodgrain-88/kit';
import { createKidPilot, type KidPilot } from '../ai/pilot.ts';
import { createMatch, stepMatch } from '../engine/match.ts';
import {
  AMMO_SEGMENTS,
  CARTRIDGE_MATCH_TICKS,
  CENTRE_RADIUS,
  CENTRE_X,
  CENTRE_Y,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FUEL_SEGMENTS,
  IDLE,
  MISSILE_RADIUS,
  POD_RADIUS,
  SHIP_RADIUS,
  SUBPIXELS,
  TICKS_PER_SECOND,
  type Controls,
  type Match,
  type Seat,
} from '../engine/types.ts';
import { variation } from '../engine/variations.ts';

const params = new URLSearchParams(location.search);
const variationNumber = Math.min(17, Math.max(1, Number(params.get('variation') ?? '1') || 1));
const target = Number(params.get('target') ?? '10') === 5 ? 5 : 10;
const speed = Math.min(8, Math.max(1, Number(params.get('speed') ?? '1') || 1));
const switchText = (params.get('switches') ?? 'BB').toUpperCase();
const switches: [SwitchPosition, SwitchPosition] = [
  switchText.startsWith('A') ? 'A' : 'B',
  switchText.charAt(1) === 'A' ? 'A' : 'B',
];
const SCALE = 6;
const COLOURS = ['#4aa8ff', '#ff8a3d'] as const;

type Pilot = { readonly kind: 'person' } | { readonly kind: 'kid'; readonly kid: KidId } | null;

function pilotFrom(text: string | null, fallback: Pilot): Pilot {
  if (text === 'person') return { kind: 'person' };
  if (text === 'idle') return null;
  const kid = text?.startsWith('kid:') ? text.slice(4) : null;
  const known = KID_IDS.find((id) => id === kid);
  return known ? { kind: 'kid', kid: known } : fallback;
}

const seats: readonly [Pilot, Pilot] = [
  pilotFrom(params.get('left'), { kind: 'person' }),
  pilotFrom(params.get('right'), { kind: 'kid', kid: 'rosa' }),
];

const held = new Set<string>();
addEventListener('keydown', (event) => {
  held.add(event.code);
  if (event.code === 'KeyP') paused = !paused;
  if (event.code === 'KeyR') restart();
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
});
addEventListener('keyup', (event) => held.delete(event.code));

const KEYS: readonly Record<keyof Controls, string>[] = [
  { left: 'KeyA', right: 'KeyD', thrust: 'KeyW', cloak: 'KeyS', fire: 'Space' },
  { left: 'ArrowLeft', right: 'ArrowRight', thrust: 'ArrowUp', cloak: 'ArrowDown', fire: 'Enter' },
];

function keyboard(seat: Seat): Controls {
  const keys = KEYS[seat];
  if (!keys) return IDLE;
  return {
    left: held.has(keys.left),
    right: held.has(keys.right),
    thrust: held.has(keys.thrust),
    cloak: held.has(keys.cloak),
    fire: held.has(keys.fire),
  };
}

let match: Match;
let pilots: (KidPilot | null)[] = [];
let paused = false;

function restart(): void {
  const seedText = params.get('seed') ?? String(Date.now());
  match = createMatch({
    rules: variation(variationNumber),
    switches,
    target,
    clockTicks: CARTRIDGE_MATCH_TICKS,
    seed: hashSeed(seedText),
  });
  pilots = seats.map((pilot, seat) =>
    pilot?.kind === 'kid'
      ? createKidPilot({ kid: pilot.kid, seat: seat as Seat, mode: 'human', seed: seedText })
      : null,
  );
}

function controlsFor(seat: Seat): Controls {
  const pilot = pilots[seat];
  if (pilot) return pilot.controls(match);
  return seats[seat]?.kind === 'person' ? keyboard(seat) : IDLE;
}

function tick(): void {
  for (const pilot of pilots) pilot?.hear(match.events, match);
  stepMatch(match, [controlsFor(0), controlsFor(1)]);
}

const canvas = document.createElement('canvas');
canvas.width = FIELD_WIDTH * SCALE;
canvas.height = FIELD_HEIGHT * SCALE + 60;
document.body.append(canvas);
const pen = canvas.getContext('2d');
if (!pen) throw new Error('no canvas');

const px = (subpixels: number) => (subpixels / SUBPIXELS) * SCALE;

function drawShip(seat: Seat): void {
  if (!pen) return;
  const ship = match.ships[seat];
  if (!ship.present) return;
  const angle = (ship.heading * Math.PI) / 8;
  const x = px(ship.x);
  const y = px(ship.y);
  pen.save();
  pen.translate(x, y);
  pen.rotate(-angle);
  pen.globalAlpha = ship.cloaked ? 0.25 : 1;
  pen.strokeStyle = COLOURS[seat];
  pen.lineWidth = 2;
  pen.beginPath();
  pen.moveTo(SHIP_RADIUS * SCALE * 1.4, 0);
  pen.lineTo(-SHIP_RADIUS * SCALE, SHIP_RADIUS * SCALE * 0.8);
  pen.lineTo(-SHIP_RADIUS * SCALE * 0.5, 0);
  pen.lineTo(-SHIP_RADIUS * SCALE, -SHIP_RADIUS * SCALE * 0.8);
  pen.closePath();
  pen.stroke();
  if (ship.thrusting) {
    pen.strokeStyle = '#ffd25a';
    pen.beginPath();
    pen.moveTo(-SHIP_RADIUS * SCALE * 0.7, 0);
    pen.lineTo(-SHIP_RADIUS * SCALE * 1.8, 0);
    pen.stroke();
  }
  pen.restore();
  pen.strokeStyle = COLOURS[seat];
  pen.globalAlpha = 0.3;
  pen.beginPath();
  pen.arc(x, y, SHIP_RADIUS * SCALE, 0, Math.PI * 2);
  pen.stroke();
  pen.globalAlpha = 1;
}

function drawShot(seat: Seat): void {
  if (!pen) return;
  const shot = match.shots[seat];
  if (!shot.live) return;
  const duel = match.setup.rules.mode === 'duel';
  pen.fillStyle = COLOURS[seat];
  pen.strokeStyle = COLOURS[seat];
  pen.beginPath();
  pen.arc(px(shot.x), px(shot.y), (duel ? MISSILE_RADIUS : POD_RADIUS) * SCALE, 0, Math.PI * 2);
  if (duel) pen.fill();
  else pen.stroke();
}

function drawBars(seat: Seat): void {
  if (!pen) return;
  const ship = match.ships[seat];
  const left = seat === 0 ? 10 : canvas.width - 250;
  const top = FIELD_HEIGHT * SCALE + 10;
  pen.fillStyle = COLOURS[seat];
  pen.font = 'bold 22px system-ui';
  pen.fillText(String(ship.score), left, top + 20);
  if (match.setup.rules.mode !== 'duel') return;
  for (let segment = 0; segment < FUEL_SEGMENTS; segment++) {
    pen.globalAlpha = segment < ship.fuel ? 1 : 0.2;
    pen.fillRect(left + 40 + segment * 24, top + 4, 20, 10);
  }
  for (let segment = 0; segment < AMMO_SEGMENTS; segment++) {
    pen.globalAlpha = segment < ship.ammo ? 1 : 0.2;
    pen.fillRect(left + 40 + segment * 24, top + 20, 20, 10);
  }
  pen.globalAlpha = 1;
}

function draw(): void {
  if (!pen) return;
  pen.fillStyle = '#0b0f1a';
  pen.fillRect(0, 0, canvas.width, canvas.height);
  const rules = match.setup.rules;
  pen.strokeStyle = rules.edges === 'bounce' ? '#8a94a8' : '#2c3445';
  pen.setLineDash(rules.edges === 'wrap' ? [6, 6] : []);
  pen.strokeRect(0.5, 0.5, FIELD_WIDTH * SCALE - 1, FIELD_HEIGHT * SCALE - 1);
  pen.setLineDash([]);
  if (rules.centre !== 'none') {
    pen.fillStyle =
      rules.centre === 'star' ? '#ffcf4a' : rules.centre === 'starbase' ? '#7fe0c0' : '#c79bff';
    pen.beginPath();
    pen.arc(px(CENTRE_X), px(CENTRE_Y), CENTRE_RADIUS * SCALE, 0, Math.PI * 2);
    pen.fill();
  }
  for (const seat of [0, 1] as const) {
    drawShot(seat);
    drawShip(seat);
    drawBars(seat);
  }
  const seconds = Math.ceil(match.clockLeft / TICKS_PER_SECOND);
  pen.fillStyle = '#c8d0e0';
  pen.font = '16px system-ui';
  pen.fillText(
    `variation ${rules.number} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` +
      (match.phase === 'over' ? ' · over (R)' : '') +
      (paused ? ' · paused' : ''),
    canvas.width / 2 - 120,
    FIELD_HEIGHT * SCALE + 40,
  );
}

let last = performance.now();
let owed = 0;
function frame(now: number): void {
  owed += ((now - last) / 1000) * TICKS_PER_SECOND * speed;
  last = now;
  if (paused) owed = 0;
  // Never fall more than a few ticks behind after the tab was hidden.
  owed = Math.min(owed, 8 * speed);
  while (owed >= 1) {
    tick();
    owed -= 1;
  }
  draw();
  requestAnimationFrame(frame);
}

restart();
requestAnimationFrame(frame);
