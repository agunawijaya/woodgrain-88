/**
 * The art direction's budget check: a look with every open cell of the arena
 * laid (both riders snaking through half the board each), measured over a few
 * seconds of frames. Dev only. ?look= ?appearance= ?quality= ?seconds=5
 * ?empty=1 measures the bare arena, to see what the trails themselves cost.
 * Writes the result to `document.body.dataset.fps` and the page title.
 */
import type { Quality } from '@woodgrain-88/arena';
import { createRng, type Appearance } from '@woodgrain-88/kit';
import { cellAt } from '../engine/grid.ts';
import { COLUMNS, ROWS, type Heading, type Laid, type Seat } from '../engine/types.ts';
import type { LookId } from '../look/look.ts';
import { createLookStage, lookById } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';

const params = new URLSearchParams(location.search);
const lookId = (params.get('look') ?? 'neon') as LookId;
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const quality = (params.get('quality') ?? 'high') as Quality;
const seconds = Number(params.get('seconds') ?? '5');

/** A rider snaking row by row through its half of the board, as the cells it would lay. */
function snake(seat: Seat, firstRow: number, lastRow: number): Laid[] {
  const laid: Laid[] = [];
  let entered: Heading = 'right';
  for (let row = firstRow; row <= lastRow; row++) {
    const rightward = (row - firstRow) % 2 === 0;
    for (let step = 1; step < COLUMNS - 1; step++) {
      const column = rightward ? step : COLUMNS - 1 - step;
      const atEnd = step === COLUMNS - 2 && row < lastRow;
      const left: Heading = atEnd ? 'down' : rightward ? 'right' : 'left';
      laid.push({ cell: cellAt(column, row), seat, entered, left });
      entered = left;
    }
  }
  return laid;
}

function main(): void {
  const host = document.getElementById('stage');
  if (!host) throw new Error('perf page needs #stage');
  const look = lookById(lookId);
  const stage = createLookStage({ host, look, appearance, quality });
  const view = look.createView({
    stage,
    appearance,
    quality,
    rng: createRng('perf'),
    seats: seatColours(),
    players: 2,
    reducedEffects: false,
  });
  stage.scene.add(view.root);
  view.reset('bordered');
  const half = Math.floor(ROWS / 2);
  if (params.get('empty') !== '1') {
    view.step([...snake(0, 1, half - 1), ...snake(1, half, ROWS - 2)], [], [], 0);
  }
  view.placeRider(0, cellAt(1, 1), 'right');
  view.placeRider(1, cellAt(COLUMNS - 2, ROWS - 2), 'left');

  const frameTimes: number[] = [];
  let last = performance.now();
  const started = last;
  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    frameTimes.push(dt);
    view.update(Math.min(0.1, dt));
    stage.render();
    if (now - started < seconds * 1000) {
      requestAnimationFrame(frame);
      return;
    }
    // The first second compiles shaders and fills caches; the budget is about the steady state.
    const settled = frameTimes.slice(Math.floor(frameTimes.length / seconds)).sort((x, y) => x - y);
    const median = settled[Math.floor(settled.length / 2)] ?? 1;
    const slow = settled[Math.floor(settled.length * 0.95)] ?? median;
    const result = `${(1 / median).toFixed(0)} fps median, ${(1 / slow).toFixed(0)} fps in the slowest 5%`;
    const gl = stage.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    document.body.dataset.gpu = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    document.body.dataset.fps = result;
    document.title = result;
  };
  requestAnimationFrame(frame);
}

main();
