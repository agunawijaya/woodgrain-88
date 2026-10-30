/**
 * Hero scenes: live renders of two moments in each look, for the owner's art
 * review and the README. The real engine plays a scripted round: each rider
 * steers by a planned list of runs, pushing its stick before every step as a
 * player would, so every trail on screen is one the rules laid. The view is
 * driven by the match's own events in fixed 20 ms ticks, so a frame comes
 * out the same every time. Dev only.
 *
 * ?look=neon|trains|mummy|ice  ?scene=duel|trap  ?appearance=light|dark
 * ?t=<extra seconds>  ?quality=high|medium|low
 * ?push=0 turns off the trap scene's crash push, for the old whole-board framing.
 * ?measure=1 keeps rendering for 300 frames and reports frame times in data-stats.
 * ?zoom=<factor>&at=<column>,<row> looks closer at one cell, for checking models.
 */
import type { Quality, Stage, TableFraming } from '@woodgrain-88/arena';
import { createRng, type Appearance } from '@woodgrain-88/kit';
import { START } from '../engine/grid.ts';
import { vectorOf } from '../engine/headings.ts';
import { createMatch, startMatch, stepMatch, upcomingHeading } from '../engine/match.ts';
import { pocketCells } from '../engine/space.ts';
import {
  COLUMNS,
  IDLE,
  ROWS,
  SEATS,
  TICKS_PER_SECOND,
  type Crash,
  type Heading,
  type Match,
  type MatchEvent,
  type Seat,
  type Stick,
} from '../engine/types.ts';
import { variationRules } from '../engine/variations.ts';
import { createCrashPush } from '../look/crash-push.ts';
import type { LookId, TrailView } from '../look/look.ts';
import { createLookStage, lookById } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';

/** The hero scenes are duels. */
const DUEL = [0, 1] as const;
const params = new URLSearchParams(location.search);
const LOOK_NAMES: readonly LookId[] = ['neon', 'trains', 'mummy', 'ice'];
const lookId: LookId = LOOK_NAMES.find((id) => id === params.get('look')) ?? 'neon';
const sceneName = params.get('scene') === 'trap' ? 'trap' : 'duel';
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const extra = Number(params.get('t') ?? '0');
const quality = (params.get('quality') ?? 'high') as Quality;

const TICK = 1 / TICKS_PER_SECOND;
/** A rider's pocket counts as a trap once it is this small and cut off from its rival. */
const TRAP_POCKET = 40;

type Run = readonly [Heading, number];

interface Story {
  readonly variation: number;
  readonly runs: readonly [readonly Run[], readonly Run[]];
  /** The step after which the frame is taken, and the seconds into the glide that follows. */
  readonly step: number;
  readonly after: number;
}

const STORIES: Record<'duel' | 'trap', Story> = {
  // Twenty seconds into a constant-speed round: orange has fenced off the left, blue the right,
  // and now they race for the same gap in the middle.
  duel: {
    variation: 1,
    runs: [
      [
        ['right', 3],
        ['up', 7],
        ['left', 3],
        ['down', 4],
        ['left', 3],
        ['up', 4],
        ['left', 4],
        ['down', 13],
        ['right', 10],
        ['up', 2],
        ['right', 9],
        ['up', 12],
      ],
      [
        ['left', 2],
        ['down', 6],
        ['right', 3],
        ['up', 3],
        ['right', 3],
        ['down', 3],
        ['right', 2],
        ['up', 13],
        ['left', 12],
        ['down', 2],
        ['right', 6],
        ['down', 4],
        ['left', 3],
        ['up', 1],
        ['left', 12],
      ],
    ],
    step: 66,
    after: 0.12,
  },
  // A speed-up round: the two race up side by side, orange cuts across the top and seals blue
  // into a pocket of nine cells against the far wall; three steps later blue rides into the seal.
  trap: {
    variation: 3,
    runs: [
      [
        ['right', 3],
        ['up', 4],
        ['right', 4],
        ['down', 11],
        ['right', 4],
        ['up', 2],
        ['right', 4],
        ['down', 2],
        ['right', 4],
        ['up', 14],
        ['left', 7],
        ['up', 2],
        ['left', 8],
      ],
      [
        ['down', 8],
        ['right', 8],
        ['up', 8],
        ['left', 2],
        ['down', 6],
        ['left', 3],
        ['up', 6],
        ['right', 2],
        ['up', 1],
        ['left', 5],
        ['up', 8],
        ['left', 9],
      ],
    ],
    step: 65,
    after: 0.2,
  },
};

/**
 * Each look's trap frame waits a little longer than the story's moment, so the watcher's
 * reaction is caught: the whistle at the lips, the pointing hand, the bolt, the melt.
 */
const REACTION_DELAY: Readonly<Record<LookId, number>> = {
  neon: 0.25,
  trains: 0.5,
  mummy: 0.5,
  ice: 0.7,
};

/** The heading each seat steers for on every step of the round, unrolled from its runs. */
function plannedHeadings(runs: readonly Run[]): Heading[] {
  return runs.flatMap(([heading, steps]) => Array.from({ length: steps }, () => heading));
}

function stickFor(heading: Heading | undefined): Stick {
  if (!heading) return IDLE;
  const { east, south } = vectorOf(heading);
  return { east, south, fire: false };
}

/** Plays the match's events on the view, and spots the trap closing as the board changes. */
function createDirector(
  view: TrailView,
  match: Match,
  onCrash?: (crashes: readonly Crash[]) => void,
) {
  const trapped = new Set<Seat>();
  const playEvents = (events: readonly MatchEvent[]) => {
    for (const event of events) {
      if (event.type === 'round') {
        view.reset(match.setup.rules.edges);
        DUEL.forEach((seat) => view.placeRider(seat, START[seat].cell, START[seat].heading));
      } else if (event.type === 'step') {
        view.step(event.laid, event.erased, event.moves, event.period / TICKS_PER_SECOND);
        spotTraps(event.laid.map((laid) => laid.cell));
      } else if (event.type === 'speed') {
        view.setSpeedStage(event.stage);
      } else if (event.type === 'crash') {
        for (const crash of event.crashes) view.crash(crash);
        onCrash?.(event.crashes);
      } else if (event.type === 'over') {
        view.freeze();
      }
    }
  };
  const spotTraps = (laidCells: readonly number[]) => {
    for (const seat of DUEL) {
      const rider = match.riders[seat];
      const rival = match.riders[seat === 0 ? 1 : 0];
      if (!rider || !rival || trapped.has(seat) || rider.crashed) continue;
      const pocket = pocketCells(match, rider.cell, TRAP_POCKET + 1);
      const rivalInside = pocket.includes(rival.cell);
      if (pocket.length > TRAP_POCKET || rivalInside) continue;
      trapped.add(seat);
      const seal = laidCells.find((cell) => match.cells[cell] === 1 - seat) ?? rival.cell;
      view.trap(seat, pocket, seal);
    }
  };
  return { playEvents };
}

/**
 * ?zoom= and ?at= look closer at one cell (column and row, either may run past the board to reach
 * a watcher): the scene slides so that cell sits in the middle, and the framing shrinks round it.
 */
function lookCloser(stage: Stage, view: TrailView, framing: TableFraming): void {
  const zoom = Number(params.get('zoom') ?? '1');
  const at = (params.get('at') ?? '').split(',').map(Number);
  if (zoom === 1 || at.length !== 2) return;
  const [column = 0, row = 0] = at;
  view.root.position.set(-(column - (COLUMNS - 1) / 2), 0, -(row - (ROWS - 1) / 2));
  stage.setFraming({
    ...framing,
    width: framing.width / zoom,
    depth: framing.depth / zoom,
    height: framing.height / zoom,
  });
}

function main(): void {
  const look = lookById(lookId);
  const host = document.getElementById('stage');
  if (!host) throw new Error('hero page needs #stage');
  const stage = createLookStage({ host, look, appearance, quality, preserveDrawingBuffer: true });
  const story = STORIES[sceneName];
  const match = createMatch({
    rules: variationRules(story.variation),
    players: 2,
    switches: ['B', 'B'],
    target: 10,
  });
  const view = look.createView({
    stage,
    appearance,
    quality,
    rng: createRng(`hero/${lookId}/${sceneName}`),
    seats: seatColours(),
    players: 2,
    reducedEffects: false,
  });
  stage.scene.add(view.root);
  lookCloser(stage, view, look.framing);

  // The trap scene shows the crash push, driven by the same fixed ticks as the rest of the scene.
  const push =
    sceneName === 'trap' && params.get('push') !== '0'
      ? createCrashPush(stage, () => view, look.framing)
      : null;
  const director = createDirector(view, match, (crashes) => {
    push?.start(crashes.map((crash) => crash.seat));
  });
  director.playEvents(startMatch(match));
  const plans = story.runs.map(plannedHeadings);
  let afterSeconds = 0;
  let guard = 0;
  while (guard < TICKS_PER_SECOND * 120) {
    const sticks = SEATS.map((seat) => stickFor(plans[seat]?.[match.steps])) as [Stick, Stick];
    director.playEvents(stepMatch(match, sticks));
    for (const seat of DUEL) {
      if (!match.riders[seat]?.crashed) view.steer(seat, upcomingHeading(match, seat));
    }
    view.update(TICK);
    stage.lights.update(TICK);
    push?.update(TICK);
    guard++;
    if (match.steps >= story.step) afterSeconds += TICK;
    const delay = sceneName === 'trap' ? REACTION_DELAY[lookId] : 0;
    if (afterSeconds >= story.after + delay + extra) break;
  }

  const ready = () => {
    document.body.dataset.ready = 'true';
  };
  let warm = 0;
  const warmUp = () => {
    stage.render();
    warm++;
    if (warm < 4) requestAnimationFrame(warmUp);
    else if (params.get('measure') === '1') requestAnimationFrame(measure);
    else ready();
  };
  requestAnimationFrame(warmUp);

  const cpu: number[] = [];
  const intervals: number[] = [];
  let last = 0;
  function measure(now: number): void {
    if (last > 0) intervals.push(now - last);
    last = now;
    const started = performance.now();
    view.update(1 / 60);
    stage.lights.update(1 / 60);
    stage.render();
    cpu.push(performance.now() - started);
    if (cpu.length < 300) {
      requestAnimationFrame(measure);
      return;
    }
    const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
    const at = (list: number[], fraction: number) =>
      sorted(list)[Math.floor(list.length * fraction)] ?? 0;
    const info = stage.renderer.info.render;
    document.body.dataset.stats = JSON.stringify({
      frameMedian: at(intervals, 0.5),
      frameP95: at(intervals, 0.95),
      cpuMedian: at(cpu, 0.5),
      cpuP95: at(cpu, 0.95),
      drawCalls: info.calls,
      triangles: info.triangles,
    });
    ready();
  }
}

try {
  main();
} catch (error: unknown) {
  document.body.dataset.error = String(error);
  console.error(error);
}
