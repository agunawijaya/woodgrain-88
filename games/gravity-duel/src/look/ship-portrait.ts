/**
 * Close-ups of a look's ships, for the pre-match cards and the game menu,
 * where the whole-field camera is too far away to show who is flying. One
 * small stage per seat renders just that ship, in its own colour, zoomed
 * tight on its start spot, with its engine idling on and off so the card
 * does not sit dead still.
 */
import type { Quality, Stage } from '@woodgrain-88/arena';
import { createRng, type Appearance } from '@woodgrain-88/kit';
import { START_SPOTS } from '../engine/match.ts';
import type { LookId, SceneFrame, SeatColours, SpaceView } from './look.ts';
import { createLookStage, lookById } from './looks.ts';
import { toTable } from '../session/frame.ts';

export interface ShipPortraitOptions {
  readonly look: LookId;
  readonly appearance: Appearance;
  /** Both seats' colours, in seat order; the look's ships draw the same way as in a match. */
  readonly seats: readonly SeatColours[];
  readonly width: number;
  readonly height: number;
  /** False with reduced motion: each ship is drawn once, engine cold. */
  readonly animate: boolean;
}

export interface ShipPortraits {
  /** One canvas per seat, in seat order, to place in the cards. */
  readonly canvases: readonly HTMLCanvasElement[];
  dispose(): void;
}

/** How wide a slice of the field the close-up shows, in table units: a few ship lengths. */
const CLOSE_UP_WIDTH = 7;
const CLOSE_UP_DEPTH = 5;
/** The engine flickers on and off at this rate, so the card is not dead still. */
const THRUST_PERIOD_SECONDS = 1.4;

interface Sitter {
  readonly stage: Stage;
  readonly view: SpaceView;
  readonly seat: 0 | 1;
}

export function createShipPortraits(options: ShipPortraitOptions): ShipPortraits {
  const look = lookById(options.look);
  const quality: Quality = 'medium';
  const sitters: Sitter[] = ([0, 1] as const).map((seat) => {
    const host = document.createElement('div');
    const stage = createLookStage({
      host,
      look,
      appearance: options.appearance,
      quality,
      preserveDrawingBuffer: true,
    });
    stage.setSize(options.width, options.height);
    stage.setFraming({ ...look.framing, width: CLOSE_UP_WIDTH, depth: CLOSE_UP_DEPTH });
    const view = look.createView({
      stage,
      appearance: options.appearance,
      quality,
      rng: createRng(`ship-portrait/${options.look}/${String(seat)}`),
      seats: options.seats,
      centre: null,
      edges: 'bounce',
      pods: 'none',
      reducedEffects: !options.animate,
    });
    stage.scene.add(view.root);
    const spot = START_SPOTS[seat];
    const { x, z } = toTable(spot.x, spot.y);
    view.root.position.set(-x, 0, -z);
    return { stage, view, seat };
  });

  function frameFor(sitter: Sitter, thrusting: boolean): SceneFrame {
    const ships: SceneFrame['ships'][number][] = [null, null];
    const spot = START_SPOTS[sitter.seat];
    const { x, z } = toTable(spot.x, spot.y);
    ships[sitter.seat] = { x, z, heading: (spot.heading * Math.PI) / 8, thrusting, cloak: 0 };
    return { ships, missiles: [null, null], pods: [null, null] };
  }

  function draw(elapsed: number): void {
    for (const sitter of sitters) {
      const thrusting =
        options.animate && elapsed % THRUST_PERIOD_SECONDS < THRUST_PERIOD_SECONDS / 2;
      sitter.view.show(frameFor(sitter, thrusting));
      sitter.view.update(0, elapsed);
      sitter.stage.render();
    }
  }

  let frameId = 0;
  let start = 0;
  function loop(now: number): void {
    if (start === 0) start = now;
    draw((now - start) / 1000);
    frameId = requestAnimationFrame(loop);
  }
  if (options.animate) frameId = requestAnimationFrame(loop);
  else draw(0);

  return {
    canvases: sitters.map((sitter) => sitter.stage.canvas),
    dispose() {
      cancelAnimationFrame(frameId);
      for (const sitter of sitters) {
        sitter.view.dispose();
        sitter.stage.dispose();
      }
    },
  };
}
