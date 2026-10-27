/**
 * Hero scenes: live renders of two moments in each look, for the owner's art
 * review and the README. A real generated board is arranged so the story's
 * squares hold the clues it needs (keeping the 1978 composition), then the
 * explorers act the story out through the same field view a match drives,
 * in fixed steps, so a frame comes out the same every time. Dev only.
 *
 * ?look=polar|tabletop|radar  ?scene=hunt|capture  ?appearance=light|dark
 * ?t=<extra seconds>  ?quality=high|medium|low
 * ?measure=1 keeps rendering for 300 frames and reports frame times in data-stats.
 */
import '@fontsource-variable/big-shoulders-display/wght';
import '@fontsource-variable/fraunces/full';
import '@fontsource-variable/atkinson-hyperlegible-next/wght';
import { createStage, type FinishOptions, type LightMood, type Quality } from '@woodgrain-88/arena';
import { createRng, type Appearance } from '@woodgrain-88/kit';
import { Color } from 'three';
import { clueAt, generateBoard, type Board, type SquareKind } from '../engine/board.ts';
import { HOME_SQUARES, squareAt, type Square } from '../engine/grid.ts';
import type { FieldView, LookId, Seat } from '../look/look.ts';
import { LOOKS } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';

const params = new URLSearchParams(location.search);
const requestedLook = params.get('look');
const lookId: LookId =
  requestedLook === 'tabletop' || requestedLook === 'radar' ? requestedLook : 'polar';
const sceneName = params.get('scene') === 'capture' ? 'capture' : 'hunt';
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const extra = Number(params.get('t') ?? '0');
const quality = (params.get('quality') ?? 'high') as Quality;

const STEP = 1 / 60;
/** The 1978 pace: a square every 0.63 s. */
const WALK_SECONDS = 0.63;

type Action =
  | { readonly walk: [number, number] }
  | { readonly reveal: number }
  | { readonly blast: true }
  | { readonly capture: true }
  | { readonly wait: number };

interface Story {
  readonly flag: [number, number];
  /** Squares whose kind the story relies on. */
  readonly kinds: readonly (readonly [number, number, SquareKind])[];
  readonly seats: readonly [readonly Action[], readonly Action[]];
  /** Seconds after the last action starts at which the frame is taken. */
  readonly moment: number;
}

const STORIES: Record<'hunt' | 'capture', Story> = {
  // Mid-hunt in a race: orange works along the top towards the warmth; blue hit a bomb, rode home,
  // and is closing in from below.
  hunt: {
    flag: [6, 2],
    kinds: [
      [0, 1, 'distance'],
      [1, 1, 'distance'],
      [2, 1, 'arrow'],
      [3, 2, 'distance'],
      [4, 1, 'distance'],
      [7, 5, 'arrow'],
      [6, 4, 'bomb'],
      [8, 5, 'distance'],
      [7, 4, 'distance'],
    ],
    seats: [
      [
        { walk: [0, 1] },
        { reveal: 0.5 },
        { walk: [1, 1] },
        { reveal: 0.5 },
        { walk: [2, 1] },
        { reveal: 0.5 },
        { walk: [3, 2] },
        { reveal: 0.6 },
        { wait: 1.6 },
        { walk: [4, 1] },
        { reveal: 9 },
      ],
      [
        { walk: [7, 5] },
        { reveal: 0.5 },
        { walk: [6, 4] },
        { blast: true },
        { wait: 0.4 },
        { walk: [8, 5] },
        { reveal: 0.5 },
        { walk: [7, 4] },
        { reveal: 0.5 },
        { walk: [7, 3] },
      ],
    ],
    moment: 0.42,
  },
  // The capture at night: the last clues all point one way and orange pulls the flag up.
  capture: {
    flag: [5, 3],
    kinds: [
      [1, 1, 'distance'],
      [2, 2, 'arrow'],
      [3, 3, 'distance'],
      [4, 2, 'distance'],
      [7, 5, 'distance'],
      [6, 4, 'arrow'],
      [7, 2, 'arrow'],
      [2, 5, 'bomb'],
    ],
    seats: [
      [
        { walk: [1, 1] },
        { reveal: 0.4 },
        { walk: [2, 2] },
        { reveal: 0.4 },
        { walk: [3, 3] },
        { reveal: 0.4 },
        { walk: [4, 2] },
        { reveal: 0.6 },
        { walk: [5, 3] },
        { capture: true },
      ],
      [
        { walk: [7, 5] },
        { reveal: 0.4 },
        { walk: [7, 4] },
        { walk: [6, 4] },
        { reveal: 0.4 },
        { walk: [7, 3] },
        { walk: [7, 2] },
        { reveal: 0.4 },
        { walk: [7, 3] },
      ],
    ],
    moment: 1.45,
  },
};

/**
 * Each look's moment differs a little from the story's: the Tabletop's tile is caught mid-turn,
 * and its capture while the ripple of jumping tiles is still running.
 */
const MOMENT_SHIFT: Partial<Record<LookId, Partial<Record<'hunt' | 'capture', number>>>> = {
  tabletop: { hunt: -0.15, capture: -0.62 },
};

/** A real board, with the story's squares swapped into the kinds it needs (the counts stay 1978's). */
function arrangeBoard(story: Story): Board {
  const generated = generateBoard(createRng(`hero/${sceneName}`));
  const kinds = [...generated.kinds];
  const flag = squareAt(...story.flag);
  const wanted = new Map(story.kinds.map(([column, row, kind]) => [squareAt(column, row), kind]));
  const swap = (a: Square, b: Square) => {
    const kindA = kinds[a] ?? 'arrow';
    kinds[a] = kinds[b] ?? 'arrow';
    kinds[b] = kindA;
  };
  // The flag's own square holds an arrow, as in 1978.
  if (kinds[flag] !== 'arrow') {
    const spare = kinds.findIndex(
      (kind, square) => kind === 'arrow' && !wanted.has(square) && square !== flag,
    );
    swap(flag, spare);
  }
  for (const [square, kind] of wanted) {
    if (kinds[square] === kind) continue;
    const spare = kinds.findIndex(
      (other, candidate) => other === kind && !wanted.has(candidate) && candidate !== flag,
    );
    if (spare >= 0) swap(square, spare);
  }
  return { kinds, flags: [flag] };
}

/** Plays each seat's actions in step, as a match would drive the view. */
function createDirector(view: FieldView, board: Board, story: Story) {
  const seats = ([0, 1] as const).map((seat) => {
    const home: Square = HOME_SQUARES[seat];
    return { seat, actions: story.seats[seat], cursor: 0, busyUntil: 0, square: home };
  });
  let clock = 0;
  let lastStart = 0;
  const run = (state: (typeof seats)[number]) => {
    const action = state.actions[state.cursor];
    if (!action) return;
    state.cursor++;
    lastStart = clock;
    const seat: Seat = state.seat;
    if ('walk' in action) {
      const to = squareAt(...action.walk);
      view.walk(seat, state.square, to, WALK_SECONDS);
      state.square = to;
      state.busyUntil = clock + WALK_SECONDS;
    } else if ('reveal' in action) {
      view.reveal(seat, state.square, clueAt(board, state.square, board.flags), { keep: true });
      state.busyUntil = clock + action.reveal;
    } else if ('blast' in action) {
      view.blast(seat, state.square);
      view.sendHome(seat, HOME_SQUARES[seat]);
      state.square = HOME_SQUARES[seat];
      state.busyUntil = clock + 1.6;
    } else if ('capture' in action) {
      view.capture(seat, state.square);
      state.busyUntil = Infinity;
    } else {
      state.busyUntil = clock + action.wait;
    }
  };
  return {
    get finished() {
      return seats.every((state) => state.cursor >= state.actions.length);
    },
    get sinceLastStart() {
      return clock - lastStart;
    },
    step(dt: number) {
      for (const state of seats) {
        if (clock >= state.busyUntil) run(state);
      }
      clock += dt;
      view.update(dt);
    },
  };
}

/** ?sun= ?hemi= ?key= (moon) override the light's strengths, for tuning a look by eye. */
function withLightOverrides(mood: LightMood): LightMood {
  const number = (name: string) =>
    params.get(name) === null ? {} : { value: Number(params.get(name)) };
  const sun = number('sun');
  const hemi = number('hemi');
  const moon = number('key');
  return {
    day: {
      ...mood.day,
      ...('value' in sun ? { sunIntensity: sun.value } : {}),
      ...('value' in hemi ? { hemiIntensity: hemi.value } : {}),
    },
    night: {
      ...mood.night,
      ...('value' in moon ? { moonIntensity: moon.value } : {}),
      ...('value' in hemi ? { hemiIntensity: hemi.value } : {}),
    },
  };
}

/** ?exposure= overrides the look's exposure for the scene's appearance. */
function withExposureOverride(
  exposure: Partial<Record<Appearance, number>>,
): Partial<Record<Appearance, number>> {
  const value = params.get('exposure');
  return value === null ? exposure : { ...exposure, [appearance]: Number(value) };
}

/** ?bloom=<strength> overrides both grades' bloom, to judge a frame without it. */
function withBloomOverride(finish: FinishOptions): FinishOptions {
  const bloom = params.get('bloom');
  if (bloom === null) return finish;
  const strength = Number(bloom);
  return {
    ...finish,
    grades: {
      light: { ...finish.grades?.light, bloom: strength },
      dark: { ...finish.grades?.dark, bloom: strength },
    },
  };
}

async function main(): Promise<void> {
  const look = LOOKS[lookId];
  const host = document.getElementById('stage');
  if (!host) throw new Error('hero page needs #stage');
  await Promise.all([
    document.fonts.load('800 64px "Big Shoulders Display Variable"'),
    document.fonts.load('700 64px "Fraunces Variable"'),
    document.fonts.load('800 64px "Atkinson Hyperlegible Next Variable"'),
  ]);

  const stage = createStage({
    host,
    appearance,
    quality,
    framing: look.framing,
    preserveDrawingBuffer: true,
    ...(look.mood ? { mood: withLightOverrides(look.mood) } : {}),
    ...(look.finish ? { finish: withBloomOverride(look.finish) } : {}),
    ...(look.reflections ? { reflections: look.reflections } : {}),
    ...(look.exposure ? { exposure: withExposureOverride(look.exposure) } : {}),
  });
  stage.scene.background = new Color(look.background(appearance));
  const story = STORIES[sceneName];
  const board = arrangeBoard(story);
  const view = look.createView({
    stage,
    appearance,
    quality,
    rng: createRng(`hero/${lookId}/${sceneName}`),
    seats: seatColours(),
    players: 2,
    reducedEffects: false,
    cluePalette: 'thermal',
  });
  stage.scene.add(view.root);
  view.placeExplorer(0, HOME_SQUARES[0]);
  view.placeExplorer(1, HOME_SQUARES[1]);

  const director = createDirector(view, board, story);
  let guard = 0;
  const moment = story.moment + (MOMENT_SHIFT[lookId]?.[sceneName] ?? 0) + extra;
  while (!(director.finished && director.sinceLastStart >= moment) && guard < 60 * 60) {
    director.step(STEP);
    stage.lights.update(STEP);
    view.flush();
    guard++;
  }

  const ready = () => {
    document.body.dataset.ready = 'true';
  };
  let warm = 0;
  const warmUp = () => {
    view.flush();
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
    view.update(STEP);
    stage.lights.update(STEP);
    view.flush();
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

main().catch((error: unknown) => {
  document.body.dataset.error = String(error);
  console.error(error);
});
