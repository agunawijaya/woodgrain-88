/**
 * Gravity Duel's in-match HUD: each seat's score; duels show fuel and
 * missile bars (8 segments each), docking shows dock counts instead; the
 * match clock, blinking for its last 1,024 ticks. The pause button is the
 * Hall's. It reads the match each frame and decides nothing.
 */
import type { Appearance } from '@woodgrain-88/kit';
import {
  AMMO_SEGMENTS,
  CLOCK_WARNING_TICKS,
  FUEL_SEGMENTS,
  TICKS_PER_SECOND,
  type Match,
  type Seat,
} from '../engine/types.ts';
import type { LookId, SeatColours } from '../look/look.ts';
import { ensureScreenStyle, LEGIBLE_FONT } from '../screens/style.ts';

export interface HudSeatInfo {
  readonly name: string;
  readonly colours: SeatColours;
}

export interface HudOptions {
  readonly host: HTMLElement;
  readonly look: LookId;
  readonly seats: readonly [HudSeatInfo, HudSeatInfo];
  readonly appearance: Appearance;
}

export interface Hud {
  /** Read the match's score, fuel, ammo, docks and clock; decide nothing. */
  update(match: Readonly<Match>): void;
  setAppearance(appearance: Appearance): void;
  dispose(): void;
}

const SEGMENTS = Math.max(FUEL_SEGMENTS, AMMO_SEGMENTS);

const STYLE = /* css */ `
.gd-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  font-family: ${LEGIBLE_FONT};
  color: #ffffff;
}
.gd-hud > * { pointer-events: auto; }

/* Each look draws its bars its own way (brief: "a CSS class per look is enough"). */
.gd-hud[data-look='deep'] .gd-hud-seg { border-radius: 1px; box-shadow: 0 0 4px currentColor; }
.gd-hud[data-look='deep'] .gd-hud-seg.is-filled { box-shadow: 0 0 6px 1px var(--seat); }
.gd-hud[data-look='brass'] .gd-hud-seg {
  border-radius: 999px;
  border: 1px solid rgba(120, 90, 30, 0.6);
  background: #2a2015;
}
.gd-hud[data-look='brass'] .gd-hud-seg.is-filled { background: var(--seat); }
.gd-hud[data-look='paper'] .gd-hud-seg {
  border-radius: 2px;
  border: 1.5px dashed rgba(255, 255, 255, 0.4);
}
.gd-hud[data-look='whirl'] .gd-hud-seg { border-radius: 999px; }

.gd-hud-top {
  position: absolute;
  top: clamp(10px, 2vh, 18px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(14px, 2.4vw, 28px);
  padding: 8px 20px;
  border-radius: 10px;
  background: rgba(10, 8, 20, 0.82);
  border: 1px solid rgba(195, 169, 255, 0.22);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.gd-hud-seat {
  display: grid;
  gap: 4px;
  justify-items: center;
}

/* The blocks set their own display, which would otherwise outrank the hidden attribute. */
.gd-hud [hidden] { display: none; }

.gd-hud-score {
  font-weight: 800;
  font-size: clamp(24px, 4vh, 36px);
  line-height: 1;
  color: var(--seat);
  font-variant-numeric: tabular-nums;
}

.gd-hud-bars { display: grid; gap: 2px; }
.gd-hud-bar { display: flex; gap: 2px; }
.gd-hud-seg {
  width: 10px;
  height: 7px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.18);
}
.gd-hud-seg.is-filled { background: var(--seat); }
.gd-hud-seg.is-fuel.is-filled { background: #ffd25a; }

.gd-hud-docks { font-weight: 700; font-size: clamp(13px, 1.8vh, 16px); color: var(--seat); }

.gd-hud-clock {
  font-weight: 800;
  font-size: clamp(18px, 2.6vh, 24px);
  font-variant-numeric: tabular-nums;
}
.gd-hud-clock.is-blinking { animation: gd-hud-blink 0.5s steps(1) infinite; }
@keyframes gd-hud-blink { 50% { opacity: 0.2; } }
@media (prefers-reduced-motion: reduce) {
  .gd-hud-clock.is-blinking { animation: none; opacity: 0.6; }
}
`;

export function createHud(options: HudOptions): Hud {
  ensureScreenStyle(options.host);

  const root = document.createElement('div');
  root.className = 'gd-hud';
  root.dataset.appearance = options.appearance;
  root.dataset.look = options.look;
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  const top = document.createElement('div');
  top.className = 'gd-hud-top';

  function seatBlock(seat: Seat): {
    readonly root: HTMLElement;
    readonly score: HTMLElement;
    readonly fuel: HTMLElement[];
    readonly ammo: HTMLElement[];
    readonly docks: HTMLElement;
  } {
    const colours = options.seats[seat].colours;
    const block = document.createElement('div');
    block.className = 'gd-hud-seat';
    block.style.setProperty('--seat', colours.main);

    const score = document.createElement('div');
    score.className = 'gd-hud-score';
    score.textContent = '0';

    const bars = document.createElement('div');
    bars.className = 'gd-hud-bars';
    const fuelRow = document.createElement('div');
    fuelRow.className = 'gd-hud-bar';
    const ammoRow = document.createElement('div');
    ammoRow.className = 'gd-hud-bar';
    const fuel = Array.from({ length: SEGMENTS }, () => {
      const seg = document.createElement('span');
      seg.className = 'gd-hud-seg is-fuel';
      fuelRow.append(seg);
      return seg;
    });
    const ammo = Array.from({ length: SEGMENTS }, () => {
      const seg = document.createElement('span');
      seg.className = 'gd-hud-seg';
      ammoRow.append(seg);
      return seg;
    });
    bars.append(fuelRow, ammoRow);

    const docks = document.createElement('div');
    docks.className = 'gd-hud-docks';
    docks.textContent = '0 docks';
    docks.hidden = true;

    block.append(score, bars, docks);
    return { root: block, score, fuel, ammo, docks };
  }

  const blocks: [ReturnType<typeof seatBlock>, ReturnType<typeof seatBlock>] = [
    seatBlock(0),
    seatBlock(1),
  ];

  const clock = document.createElement('div');
  clock.className = 'gd-hud-clock';
  clock.textContent = '0:00';

  top.append(blocks[0].root, clock, blocks[1].root);

  root.append(top);
  options.host.append(root);

  function setSegments(elements: readonly HTMLElement[], count: number, limit: number): void {
    elements.forEach((el, index) => {
      el.hidden = index >= limit;
      el.classList.toggle('is-filled', index < count);
    });
  }

  return {
    update(match) {
      const duel = match.setup.rules.mode === 'duel';
      for (const seat of [0, 1] as const) {
        const ship = match.ships[seat];
        const block = blocks[seat];
        block.root.hidden = !ship.present;
        block.score.textContent = String(ship.score);
        block.docks.hidden = duel;
        if (!duel)
          block.docks.textContent = `${String(ship.score)} ${ship.score === 1 ? 'dock' : 'docks'}`;
        for (const el of [...block.fuel, ...block.ammo]) el.hidden = !duel;
        if (duel) {
          setSegments(block.fuel, ship.fuel, FUEL_SEGMENTS);
          setSegments(block.ammo, ship.ammo, AMMO_SEGMENTS);
        }
      }
      const seconds = Math.ceil(match.clockLeft / TICKS_PER_SECOND);
      clock.textContent = `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
      clock.classList.toggle('is-blinking', match.clockLeft <= CLOCK_WARNING_TICKS);
    },
    setAppearance(appearance) {
      root.dataset.appearance = appearance;
    },
    dispose() {
      root.remove();
    },
  };
}
