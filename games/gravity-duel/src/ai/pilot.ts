/**
 * A Neighbourhood Kid at the stick of a Gravity Duel ship.
 *
 * Every few ticks the Kid looks at the field (perception.ts), forecasts what
 * matters (forecast.ts) and makes up its mind: get clear of the star, dodge
 * or cloak from a missile it noticed, line up a shot, head for the starbase,
 * or move to the range it likes. The kit's reflexes carry that decision to
 * its hands late and sometimes wrong; the kit's aim makes it lead a moving
 * target by the wrong amount and hold a burn too long. The hands then work
 * the stick tick by tick, at the cartridge's own turning rate.
 */
import {
  aimProfile,
  createKidReflex,
  createRng,
  heldFor,
  leadShare,
  memoryProfile,
  reflexProfile,
  type AimProfile,
  type KidId,
  type KidMemory,
  type KidReflex,
  type MemoryMode,
  type Pressure,
  type ReflexProfile,
  type Rng,
  type Seed,
} from '@woodgrain-88/kit';
import { axisDelta } from '../engine/physics.ts';
import {
  CENTRE_RADIUS,
  CENTRE_X,
  CENTRE_Y,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FINE_PER_UNIT,
  IDLE,
  MISSILE_LIFE,
  MISSILE_RADIUS,
  POD_RADIUS,
  SHIP_RADIUS,
  SHIP_WALL_MARGIN,
  SUBPIXELS,
  TICKS_PER_SECOND,
  TOP_SPEED_UNITS,
  type Controls,
  type Match,
  type MatchEvent,
  type Seat,
  type Ship,
  type VariationRules,
} from '../engine/types.ts';
import {
  bestShot,
  closestApproach,
  coastTrack,
  coastTo,
  distanceFromCentre,
  headingDifference,
  headingToward,
  ticksToCentre,
  type Motion,
  type Shot,
} from './forecast.ts';
import { createWatcher, type Beliefs, type CountFact, type Sighting } from './perception.ts';
import { PILOT_STYLES, type PilotStyle } from './styles.ts';

/** What the Kid has made up its mind to do; its hands work out the stick. */
export interface Manoeuvre {
  /** The heading it wants to point. */
  readonly face: number;
  readonly thrust: boolean;
  /** Fire once it points that way. */
  readonly fire: boolean;
  /** Whether it wants to be cloaked. */
  readonly cloak: boolean;
}

export type Intent = 'escape' | 'dodge' | 'cloak' | 'attack' | 'move' | 'refuel' | 'dock';

/** One decision, kept for the results panel's replay of how the Kid flew it. */
export interface PilotMoment {
  readonly tick: number;
  readonly intent: Intent;
  readonly face: number;
  /** The shot it lined up, if it was attacking. */
  readonly shot: Shot | null;
  readonly beliefs: Beliefs;
}

export interface KidPilotOptions {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly mode: MemoryMode;
  readonly seed: Seed;
  /** Profiles other than the Kid's own, for simulations and tuning. */
  readonly reflex?: ReflexProfile;
  readonly aim?: AimProfile;
  readonly style?: PilotStyle;
}

export interface KidPilot {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly reflex: KidReflex<Manoeuvre>;
  readonly memory: KidMemory<CountFact>;
  /** The most recent decisions, oldest first. */
  readonly moments: readonly PilotMoment[];
  /** Everything the match said last tick: the Kid takes in what a player would. */
  hear(events: readonly MatchEvent[], match: Readonly<Match>): void;
  /** What the Kid's hands hold this tick. */
  controls(match: Readonly<Match>): Controls;
}

/** A person re-reads the field about ten times a second. */
const DECIDE_EVERY = 5;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
/** How many ticks ahead one step of the reflex profile's lookahead reads. */
const LOOKAHEAD_TICKS_PER_STEP = 18;
/** How far round itself, in field steps, one step of awareness reaches. */
const AWARENESS_STEPS_PER_STEP = 6;
/** Steps of clearance that make a forecast missile a threat. */
const DODGE_MARGIN = 3;
/** The longest a Kid's overshoot carries a burn past the point, in ticks. */
const MAX_HANGOVER = 30;
/** A Kid re-judges a pod's drift about once a second, and twice as sharply up close. */
const REJUDGE_EVERY = 50;
const CLOSE_TO_POD = 15;
/** How far ahead, and how finely, a Kid looks for where to meet a pod. */
const INTERCEPT_TICKS = 200;
const INTERCEPT_EVERY = 10;
const MOMENTS_KEPT = 120;

const WIDTH = FIELD_WIDTH * SUBPIXELS;
const HEIGHT = FIELD_HEIGHT * SUBPIXELS;

interface Plan {
  readonly manoeuvre: Manoeuvre;
  readonly intent: Intent;
  /** Part of what the Kid was already doing, so its hands only time it. */
  readonly foreseen: boolean;
  readonly shot?: Shot;
}

export function createKidPilot(options: KidPilotOptions): KidPilot {
  const { kid, seat, mode } = options;
  const rng = createRng(options.seed).fork(`pilot-${kid}-${seat}`);
  const reflexes = options.reflex ?? reflexProfile(kid, mode);
  const aim = options.aim ?? aimProfile(kid, mode);
  const style = options.style ?? pilotStyle(kid, mode);
  const reflex = createKidReflex<Manoeuvre>(reflexes, rng.fork('reflex'));
  const watcher = createWatcher(
    seat,
    memoryProfile(kid, mode),
    reflexes.awareness * AWARENESS_STEPS_PER_STEP,
    rng.fork('memory'),
  );
  const choices = rng.fork('choices');
  const hands = createHands(aim, style, choices.fork('hands'));
  const lookahead = reflexes.lookahead * LOOKAHEAD_TICKS_PER_STEP;
  const moments: PilotMoment[] = [];

  let shotSense = drawShotSense();
  let podJudgement = { share: leadShare(aim, choices), since: 0 };
  let dodgeByCloak: boolean | null = null;
  let waypoint: Motion | null = null;
  let lastPressure: Pressure = { speed: 0, cramp: 0 };

  function hear(events: readonly MatchEvent[], match: Readonly<Match>): void {
    watcher.hear(events, match, () => reflex.notices(match.tick * MS_PER_TICK, lastPressure));
    for (const event of events) {
      // Each shot is lined up afresh, with that moment's feel for the lead.
      if (event.kind === 'fired' && event.seat === seat) shotSense = drawShotSense();
      if (event.kind === 'docked' && event.seat === seat) rejudgePod(match.tick);
    }
    if (!match.shots[seat === 0 ? 1 : 0].live) dodgeByCloak = null;
  }

  /**
   * How the Kid will reckon its next shot: its lead, how far off it judges the target's bearing,
   * and how much it allows for the star. Drawn once per shot, so a Kid keeps lining up the same
   * slightly wrong shot until it fires, as a person does.
   */
  function drawShotSense(): {
    readonly lead: number;
    readonly skew: number;
    readonly pull: number;
  } {
    if (choices.chance(style.perfectShot)) return { lead: 1, skew: 0, pull: 1 };
    return {
      lead: leadShare(aim, choices),
      skew: ((normalDraw(choices) * style.aimNoise) / 180) * Math.PI,
      pull: style.pullSense,
    };
  }

  function rejudgePod(tick: number): void {
    podJudgement = { share: leadShare(aim, choices), since: tick };
  }

  function controls(match: Readonly<Match>): Controls {
    const ship = match.ships[seat];
    if (!ship.present || match.phase !== 'playing') return IDLE;
    if (match.tick % DECIDE_EVERY === 0) think(match, ship);
    return hands.work(reflex.act(match.tick * MS_PER_TICK), ship, match.setup.rules);
  }

  function think(match: Readonly<Match>, ship: Ship): void {
    const beliefs = watcher.beliefs(match);
    lastPressure = pressureOn(match, ship);
    const plan =
      match.setup.rules.mode === 'duel' ? planDuel(match, ship, beliefs) : planDock(match, ship);
    remember({
      tick: match.tick,
      intent: plan.intent,
      face: plan.manoeuvre.face,
      shot: plan.shot ?? null,
      beliefs,
    });
    const planned = reflex.planned();
    if (planned && sameManoeuvre(planned, plan.manoeuvre)) return;
    reflex.decide(
      plan.manoeuvre,
      match.tick * MS_PER_TICK,
      lastPressure,
      fumblesOf(plan.manoeuvre),
      plan.foreseen,
    );
  }

  function remember(moment: PilotMoment): void {
    moments.push(moment);
    if (moments.length > MOMENTS_KEPT) moments.shift();
  }

  function planDuel(match: Readonly<Match>, ship: Ship, beliefs: Beliefs): Plan {
    const rules = match.setup.rules;
    const own = motionOf(ship);
    const rival = watcher.rival(match);
    return (
      escapeStar(rules, ship, own) ??
      dodgeMissile(match, ship, own, beliefs) ??
      (ship.cloaked ? uncloak(ship) : null) ??
      headForStarbase(rules, ship, own, beliefs) ??
      lineUpShot(match, ship, own, rival, beliefs) ??
      reposition(match, ship, own, rival, beliefs)
    );
  }

  function escapeStar(rules: VariationRules, ship: Ship, own: Motion): Plan | null {
    if (rules.centre !== 'star' || ship.cloaked) return null;
    const clearance = CENTRE_RADIUS + SHIP_RADIUS + style.starMargin * reflexes.style.safety;
    if (ticksToCentre(own, lookahead, rules, SHIP_WALL_MARGIN, clearance) === null) return null;
    // Burn along the orbit, the way it is already going, and a little outward.
    const rx = (ship.x - CENTRE_X) / SUBPIXELS;
    const ry = (ship.y - CENTRE_Y) / SUBPIXELS;
    const spin = Math.sign(rx * ship.vy - ry * ship.vx) || 1;
    const length = Math.hypot(rx, ry) || 1;
    const face = headingToward(-ry * spin + (0.5 * rx) / length, rx * spin + (0.5 * ry) / length);
    return { manoeuvre: burn(face), intent: 'escape', foreseen: false };
  }

  function dodgeMissile(
    match: Readonly<Match>,
    ship: Ship,
    own: Motion,
    beliefs: Beliefs,
  ): Plan | null {
    const missile = watcher.rivalMissile(match);
    if (!missile) return null;
    const rules = match.setup.rules;
    const ticks = Math.min(lookahead, MISSILE_LIFE);
    const pass = closestApproach(missile, own, 1, ticks, rules, MISSILE_RADIUS);
    if (pass.miss > SHIP_RADIUS + MISSILE_RADIUS + DODGE_MARGIN) return null;
    if (dodgeByCloak === null) {
      const affordable = beliefs.fuel > Math.max(1, style.fuelReserve);
      dodgeByCloak = rules.cloak && affordable && choices.chance(style.cloakUse);
    }
    if (dodgeByCloak) {
      return {
        manoeuvre: { ...coast(ship.heading), cloak: true },
        intent: 'cloak',
        foreseen: false,
      };
    }
    // Burn square to the missile's path, on the side the ship is already on.
    const side = Math.sign(
      (missile.vx / FINE_PER_UNIT) * ((ship.y - missile.y) / SUBPIXELS) -
        (missile.vy / FINE_PER_UNIT) * ((ship.x - missile.x) / SUBPIXELS),
    );
    const face = headingToward(-missile.vy * (side || 1), missile.vx * (side || 1));
    return { manoeuvre: burn(face), intent: 'dodge', foreseen: false };
  }

  function uncloak(ship: Ship): Plan {
    return { manoeuvre: coast(ship.heading), intent: 'cloak', foreseen: true };
  }

  function headForStarbase(
    rules: VariationRules,
    ship: Ship,
    own: Motion,
    beliefs: Beliefs,
  ): Plan | null {
    if (rules.centre !== 'starbase' || !style.starbase) return null;
    if (beliefs.fuel > style.fuelReserve && beliefs.ammo > 0) return null;
    const toward = unitToward(own, { x: CENTRE_X, y: CENTRE_Y }, rules);
    const plan = steer(ship, toward.x * style.cruise, toward.y * style.cruise, 2, 'refuel');
    return { ...plan, foreseen: true };
  }

  function lineUpShot(
    match: Readonly<Match>,
    ship: Ship,
    own: Motion,
    rival: Sighting | null,
    beliefs: Beliefs,
  ): Plan | null {
    if (!rival || match.shots[seat].live || beliefs.ammo <= 0) return null;
    const rules = match.setup.rules;
    // Nobody wastes a shot on a target across the field: a person closes in first.
    if (distanceBetween(own, rival, rules) > style.fireRange) return null;
    // Plan from where both will be once the hands get there.
    const delay = Math.round(reflex.expectedDelay(lastPressure, true) / MS_PER_TICK);
    const from = coastTo(own, delay, rules, SHIP_WALL_MARGIN);
    const target = skewed(
      from,
      {
        ...rival,
        x: rival.x + (rival.vx >> 4) * delay,
        y: rival.y + (rival.vy >> 4) * delay,
      },
      shotSense.skew,
    );
    const shot = bestShot(from, target, rules, headingsNear(ship.heading), {
      lead: shotSense.lead,
      pull: shotSense.pull,
      tolerance: style.shotTolerance,
      bendBonus: style.slingshot,
    });
    if (!shot) return null;
    return {
      manoeuvre: { face: shot.heading, thrust: false, fire: true, cloak: false },
      intent: 'attack',
      foreseen: true,
      shot,
    };
  }

  function reposition(
    match: Readonly<Match>,
    ship: Ship,
    own: Motion,
    rival: Sighting | null,
    beliefs: Beliefs,
  ): Plan {
    const rules = match.setup.rules;
    if (reflexes.style.mirror > 0 && rival && !match.ships[seat === 0 ? 1 : 0].cloaked) {
      const copied = match.ships[seat === 0 ? 1 : 0];
      return {
        manoeuvre: { face: copied.heading, thrust: copied.thrusting, fire: false, cloak: false },
        intent: 'move',
        foreseen: false,
      };
    }
    const goal = wanderGoal(match) ?? rival;
    if (!goal) return { manoeuvre: coast(ship.heading), intent: 'move', foreseen: true };
    const distance = distanceBetween(own, goal, rules);
    const toward = unitToward(own, goal, rules);
    // Close in or back off toward the range it likes, easing off as it gets there, and circle
    // the rival as it goes: a moving ship is harder to hit, and people in a momentum game never
    // sit still for long.
    const radial = goal === rival ? Math.max(-1, Math.min(1, (distance - style.range) / 20)) : 1;
    const circling = goal === rival ? style.orbit * orbitSide(own, toward) : 0;
    const wantX = (toward.x * radial - toward.y * circling) * style.cruise;
    const wantY = (toward.y * radial + toward.x * circling) * style.cruise;
    const frugal = beliefs.fuel <= style.fuelReserve;
    const deadband = frugal ? style.deadband * 2 + 6 : style.deadband;
    const plan = steer(ship, wantX, wantY, deadband, 'move');
    if (plan.manoeuvre.thrust || !rival) return plan;
    // Coasting: point at the rival, ready to shoot.
    return { ...plan, manoeuvre: coast(headingToward(toward.x, toward.y)) };
  }

  function wanderGoal(match: Readonly<Match>): Motion | null {
    if (style.wander <= 0) return null;
    const ship = match.ships[seat];
    const reached = waypoint && distanceBetween(motionOf(ship), waypoint, match.setup.rules) < 10;
    const whim = choices.chance((style.wander * DECIDE_EVERY) / TICKS_PER_SECOND);
    if (reached) waypoint = null;
    if (whim) {
      waypoint = waypoint
        ? null
        : {
            x: choices.int(20, FIELD_WIDTH - 20) * SUBPIXELS,
            y: choices.int(12, FIELD_HEIGHT - 12) * SUBPIXELS,
            vx: 0,
            vy: 0,
          };
    }
    return waypoint;
  }

  function planDock(match: Readonly<Match>, ship: Ship): Plan {
    const rules = match.setup.rules;
    const pod = match.shots[rules.pods === 'own' ? seat : 0];
    if (!pod.live) return { manoeuvre: coast(ship.heading), intent: 'dock', foreseen: true };
    if (match.tick - podJudgement.since >= REJUDGE_EVERY) rejudgePod(match.tick);
    const own = motionOf(ship);
    const distance = distanceBetween(own, pod, rules);
    const fine = match.setup.switches[seat] === 'A';
    // A Kid misjudges how the pod drifts relative to it, less so up close.
    const error = (1 - podJudgement.share) * (distance < CLOSE_TO_POD ? 0.5 : 1);
    const seen: Motion = {
      ...pod,
      vx: Math.round(ship.vx + (pod.vx - ship.vx) * (1 - error)),
      vy: Math.round(ship.vy + (pod.vy - ship.vy) * (1 - error)),
    };
    const want =
      distance < CLOSE_TO_POD
        ? matchAndClose(own, seen, distance, fine, rules)
        : intercept(own, seen, rules);
    const plan = steer(ship, want.x, want.y, fine ? 0.6 : 2, 'dock');
    return { ...plan, foreseen: true };
  }

  /** Up close: take on the pod's drift and ease in, slowly enough that the speeds still match. */
  function matchAndClose(
    own: Motion,
    pod: Motion,
    distance: number,
    fine: boolean,
    rules: VariationRules,
  ): { readonly x: number; readonly y: number } {
    const closing = Math.min(fine ? 3 : 9, distance * 0.35);
    const toward = unitToward(own, pod, rules);
    return {
      x: pod.vx / FINE_PER_UNIT + toward.x * closing,
      y: pod.vy / FINE_PER_UNIT + toward.y * closing,
    };
  }

  /**
   * Further off: aim for where the pod will be, walls and the beacon's pull included, choosing
   * the meeting that asks least of the engine now and leaves least to match on arrival. Chasing
   * the pod's present drift fails as soon as it bounces off a wall.
   */
  function intercept(
    own: Motion,
    pod: Motion,
    rules: VariationRules,
  ): { readonly x: number; readonly y: number } {
    let best = { x: pod.vx / FINE_PER_UNIT, y: pod.vy / FINE_PER_UNIT };
    let bestCost = Infinity;
    const track = coastTrack(pod, INTERCEPT_TICKS, rules, POD_RADIUS, INTERCEPT_EVERY);
    track.forEach((ahead, index) => {
      const ticks = (index + 1) * INTERCEPT_EVERY;
      // Speed units needed to arrive in `ticks`: a sixteenth of a step a tick each.
      const needX = (axisDelta(own.x, ahead.x, WIDTH, rules.edges) / SUBPIXELS / ticks) * 16;
      const needY = (axisDelta(own.y, ahead.y, HEIGHT, rules.edges) / SUBPIXELS / ticks) * 16;
      const change = Math.hypot(needX - own.vx / FINE_PER_UNIT, needY - own.vy / FINE_PER_UNIT);
      const mismatch = Math.hypot(
        needX - ahead.vx / FINE_PER_UNIT,
        needY - ahead.vy / FINE_PER_UNIT,
      );
      const cost = change + mismatch * 0.6 + ticks * 0.02;
      if (cost < bestCost) {
        bestCost = cost;
        best = { x: needX, y: needY };
      }
    });
    return best;
  }

  return {
    kid,
    seat,
    reflex,
    memory: watcher.memory,
    get moments() {
      return moments;
    },
    hear,
    controls,
  };
}

/** A Kid's flying habits; Sharp Kids judge a target twice as well and allow fully for the star. */
export function pilotStyle(kid: KidId, mode: MemoryMode): PilotStyle {
  const style = PILOT_STYLES[kid];
  return mode === 'sharp' ? { ...style, aimNoise: style.aimNoise / 2, pullSense: 1 } : style;
}

/** Burn toward the wanted velocity (speed units) when it is further off than `deadband`. */
function steer(ship: Ship, wantX: number, wantY: number, deadband: number, intent: Intent): Plan {
  const dx = wantX - ship.vx / FINE_PER_UNIT;
  const dy = wantY - ship.vy / FINE_PER_UNIT;
  const face = headingToward(dx, dy);
  if (Math.hypot(dx, dy) <= deadband) {
    return { manoeuvre: coast(face), intent, foreseen: true };
  }
  return { manoeuvre: burn(face), intent, foreseen: true };
}

function burn(face: number): Manoeuvre {
  return { face, thrust: true, fire: false, cloak: false };
}

function coast(face: number): Manoeuvre {
  return { face, thrust: false, fire: false, cloak: false };
}

function sameManoeuvre(a: Manoeuvre, b: Manoeuvre): boolean {
  return a.face === b.face && a.thrust === b.thrust && a.fire === b.fire && a.cloak === b.cloak;
}

/** What a fumble can turn a decision into: the heading one notch either side. */
function fumblesOf(manoeuvre: Manoeuvre): Manoeuvre[] {
  return [
    { ...manoeuvre, face: (manoeuvre.face + 1) % 16 },
    { ...manoeuvre, face: (manoeuvre.face + 15) % 16 },
  ];
}

/** Headings to try for a shot: those a quarter turn either way first, the rest only if needed. */
function headingsNear(heading: number): number[] {
  return Array.from({ length: 9 }, (_, index) => (heading + index - 4 + 16) % 16);
}

/** Which way round the rival the ship is already going (+1 or −1), so circling keeps its way. */
function orbitSide(own: Motion, toward: { readonly x: number; readonly y: number }): number {
  const across = -toward.y * own.vx + toward.x * own.vy;
  return across < 0 ? -1 : 1;
}

/** The target as the Kid judges it: its bearing from `from` turned by `skew` radians. */
function skewed(from: Motion, target: Motion, skew: number): Motion {
  if (skew === 0) return target;
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const cos = Math.cos(skew);
  const sin = Math.sin(skew);
  return {
    ...target,
    x: Math.round(from.x + dx * cos - dy * sin),
    y: Math.round(from.y + dx * sin + dy * cos),
  };
}

// One draw from a standard normal distribution (Box-Muller), from the Kid's own stream.
function normalDraw(rng: Rng): number {
  let u = rng.next();
  while (u === 0) u = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

function motionOf(ship: Ship): Motion {
  return { x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy };
}

function distanceBetween(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  rules: VariationRules,
): number {
  const dx = axisDelta(from.x, to.x, WIDTH, rules.edges) / SUBPIXELS;
  const dy = axisDelta(from.y, to.y, HEIGHT, rules.edges) / SUBPIXELS;
  return Math.hypot(dx, dy);
}

function unitToward(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  rules: VariationRules,
): { readonly x: number; readonly y: number } {
  const dx = axisDelta(from.x, to.x, WIDTH, rules.edges);
  const dy = axisDelta(from.y, to.y, HEIGHT, rules.edges);
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function pressureOn(match: Readonly<Match>, ship: Ship): Pressure {
  const speed = Math.hypot(ship.vx, ship.vy) / FINE_PER_UNIT / TOP_SPEED_UNITS;
  const nearStar =
    match.setup.rules.centre === 'star'
      ? 1 - (distanceFromCentre(ship.x, ship.y) - CENTRE_RADIUS) / 40
      : 0;
  return { speed: clamp01(speed), cramp: clamp01(nearStar) };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface Hands {
  /** The stick this tick for what the Kid has decided (or nothing yet). */
  work(manoeuvre: Manoeuvre | null, ship: Ship, rules: VariationRules): Controls;
}

/**
 * The Kid's hands: turn toward the heading it wants at the cartridge's rate, burn once lined up,
 * fire once pointing, pull the stick down on its own to cloak. A burn the Kid decides to stop
 * carries on a little longer, by the Kid's overshoot.
 */
function createHands(aim: AimProfile, style: PilotStyle, rng: Rng): Hands {
  let burning = 0;
  let hangover = 0;
  let pulledCloak = false;

  function work(manoeuvre: Manoeuvre | null, ship: Ship, rules: VariationRules): Controls {
    if (!manoeuvre) return IDLE;
    if (rules.cloak && manoeuvre.cloak !== ship.cloaked) {
      // The cloak toggles on a pull and needs letting go between pulls.
      pulledCloak = !pulledCloak;
      return pulledCloak ? { ...IDLE, cloak: true } : IDLE;
    }
    pulledCloak = false;
    if (ship.cloaked) return IDLE;
    const off = headingDifference(ship.heading, manoeuvre.face);
    const lined = Math.abs(off) <= style.sloppiness;
    return {
      left: off > 0,
      right: off < 0,
      thrust: thrustFor(manoeuvre.thrust, lined),
      cloak: false,
      fire: manoeuvre.fire && off === 0,
    };
  }

  function thrustFor(wanted: boolean, lined: boolean): boolean {
    if (wanted) {
      hangover = 0;
      if (lined) burning += 1;
      return lined;
    }
    if (burning > 0) {
      hangover = Math.min(MAX_HANGOVER, Math.round(heldFor(burning, aim, rng) - burning));
      burning = 0;
    }
    if (hangover > 0) {
      hangover -= 1;
      return true;
    }
    return false;
  }

  return { work };
}
