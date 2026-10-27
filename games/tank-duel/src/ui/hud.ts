/**
 * The match HUD: two enamel score plates on the top edge in the sides'
 * colours, and between them the round clock as a burning fuse. In the last
 * twenty seconds the spark runs faster and the plates blink, as the 1977
 * scores did. A scoring bank shot raises a small "BANK ×3" tag where it hit.
 * By day the plates are painted tin; by night they are lit from behind like
 * a scoreboard. Everything lives inside the game's host element.
 */
import type { Appearance } from '@woodgrain-88/kit';
import { ROUND_SECONDS, WARNING_SECONDS } from '../engine/rules.ts';
import type { MatchState, ScoringRule, Side } from '../engine/types.ts';
import { teamColours, type TeamPalette } from '../render/teams.ts';

export interface HudSeat {
  readonly name: string;
  /** Small print under the name: "Handicap", a kid's style line, or nothing. */
  readonly note: string;
}

export interface HudOptions {
  readonly host: HTMLElement;
  readonly seats: readonly [HudSeat, HudSeat];
  readonly scoring: ScoringRule;
  readonly appearance: Appearance;
  readonly reducedMotion: boolean;
  readonly palette?: TeamPalette;
}

export interface Hud {
  update(state: MatchState): void;
  /** Raises the bank tag at a point on screen (CSS pixels inside the host). */
  bank(x: number, y: number, bounces: number): void;
  setAppearance(appearance: Appearance): void;
  dispose(): void;
}

const STYLE = /* css */ `
.td-hud {
  --plate-ink: #1d1610;
  --plate-shine: rgba(255, 255, 255, 0.5);
  --fuse-cord: #7a6248;
  --fuse-burnt: rgba(40, 30, 22, 0.55);
  position: absolute;
  inset: 0 0 auto 0;
  height: 9vh;
  min-height: 56px;
  display: grid;
  grid-template-columns: minmax(150px, 22%) 1fr minmax(150px, 22%);
  align-items: center;
  gap: 2vw;
  /* Clear of the Hall's pause button (top right, 16 px in) on both sides, so neither plate is favoured. */
  padding: 0 max(2.5vw, 112px);
  pointer-events: none;
  font-family: 'Big Shoulders Display Variable', 'Big Shoulders Display', 'Arial Narrow', system-ui, sans-serif;
  color: var(--plate-ink);
  z-index: 2;
}
.td-hud[data-appearance='dark'] {
  --plate-ink: #fff6e6;
  --plate-shine: rgba(255, 255, 255, 0.18);
  --fuse-cord: #b39470;
  --fuse-burnt: rgba(0, 0, 0, 0.5);
}
.td-hud-plate {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.8em;
  height: 72%;
  padding: 0 1em 0 0.7em;
  border-radius: 10px;
  background:
    linear-gradient(180deg, var(--plate-shine), transparent 45%),
    var(--team);
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.25),
    inset 0 2px 0 rgba(255, 255, 255, 0.35),
    0 3px 0 rgba(0, 0, 0, 0.35),
    0 6px 14px rgba(0, 0, 0, 0.3);
  transform-origin: 50% 0;
}
.td-hud[data-appearance='dark'] .td-hud-plate {
  background:
    radial-gradient(120% 140% at 50% 0%, rgba(255, 255, 255, 0.22), transparent 60%),
    color-mix(in srgb, var(--team) 72%, #120c08);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.2),
    0 0 22px color-mix(in srgb, var(--team) 55%, transparent),
    0 4px 12px rgba(0, 0, 0, 0.6);
}
.td-hud-plate::before,
.td-hud-plate::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff8, #0006);
}
.td-hud-plate::before { left: 6px; }
.td-hud-plate::after { right: 6px; }
.td-hud-plate[data-side='1'] { grid-template-columns: 1fr auto; padding: 0 0.7em 0 1em; }
.td-hud-plate[data-side='1'] .td-score { order: 2; }
.td-hud-plate[data-side='1'] .td-who { text-align: right; }
.td-score {
  font-size: clamp(30px, 5.6vh, 64px);
  font-weight: 800;
  line-height: 1;
  min-width: 1.4em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
}
.td-who { display: grid; gap: 2px; min-width: 0; }
.td-name {
  font-size: clamp(15px, 2.2vh, 24px);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.td-note { font-size: clamp(11px, 1.4vh, 15px); font-weight: 600; opacity: 0.78; white-space: nowrap; }
.td-hud.is-warning .td-hud-plate { animation: td-blink 1.28s steps(1, end) infinite; }
@keyframes td-blink {
  0%, 74% { opacity: 1; }
  75%, 100% { opacity: 0.25; }
}
.td-fuse { position: relative; height: 100%; }
.td-fuse svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.td-fuse .cord { stroke: var(--fuse-cord); stroke-width: 5; stroke-linecap: round; fill: none; stroke-dasharray: 2 3; }
.td-fuse .burnt { stroke: var(--fuse-burnt); stroke-width: 4; stroke-linecap: round; fill: none; }
.td-fuse .spark { filter: drop-shadow(0 0 6px #ffb347) drop-shadow(0 0 14px #ff7a1a); }
.td-fuse .pip { fill: var(--fuse-burnt); }
.td-fuse .pip.is-lit { fill: var(--fuse-cord); }
.td-bank {
  position: absolute;
  transform: translate(-50%, -100%);
  font-family: inherit;
  font-weight: 800;
  font-size: clamp(18px, 3vh, 34px);
  letter-spacing: 0.06em;
  color: #fff4dc;
  text-shadow: 0 0 10px #ff8a2a, 0 2px 0 #3a1e08;
  animation: td-bank 1.4s ease-out forwards;
  pointer-events: none;
  white-space: nowrap;
}
@keyframes td-bank {
  0% { opacity: 0; transform: translate(-50%, -60%) scale(0.6); }
  15% { opacity: 1; transform: translate(-50%, -110%) scale(1.15); }
  70% { opacity: 1; transform: translate(-50%, -150%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -190%) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .td-bank { animation-duration: 1ms; }
  .td-hud.is-warning .td-hud-plate { animation: none; outline: 3px solid #fff4dc; }
}
`;

const SVG = 'http://www.w3.org/2000/svg';

export function createHud(options: HudOptions): Hud {
  const root = document.createElement('div');
  root.className = 'td-hud';
  root.dataset.appearance = options.appearance;
  root.setAttribute('aria-hidden', 'true');
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  const plates = options.seats.map((seat, side) => plate(seat, side as Side));
  const fuse = createFuse(options.scoring);
  const [left, right] = plates;
  if (!left || !right) throw new Error('two seats');
  root.append(left.element, fuse.element, right.element);
  options.host.append(root);
  // The plates are pictures; each point is also said aloud for screen readers.
  const announcer = document.createElement('p');
  announcer.setAttribute('role', 'status');
  announcer.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
  options.host.append(announcer);

  let shownScores: readonly [number, number] = [0, 0];
  plates.forEach((item, side) =>
    // The sides' trim colours, as on the miniatures; night darkens them in the stylesheet.
    item.element.style.setProperty('--team', teamColours(options.palette).plates[side as Side]),
  );

  return {
    update(state) {
      plates.forEach((item, side) => {
        const score = state.scores[side as Side];
        if (score !== shownScores[side as Side]) {
          item.score.textContent = String(score);
          // The plate slams up for the point; the Web Animations API restarts cleanly on a quick second point.
          if (!options.reducedMotion) {
            item.element.animate(
              [
                { transform: 'translateY(-38%) scale(1.08)' },
                { transform: 'translateY(4%) scale(0.98)', offset: 0.6 },
                { transform: 'none' },
              ],
              { duration: 420, easing: 'cubic-bezier(0.2, 1.6, 0.4, 1)' },
            );
          }
        }
      });
      if (state.scores[0] !== shownScores[0] || state.scores[1] !== shownScores[1]) {
        const scorer = state.scores[0] !== shownScores[0] ? 0 : 1;
        announcer.textContent = `${options.seats[scorer].name} scores. ${state.scores[0]}–${state.scores[1]}.`;
      }
      shownScores = state.scores;
      const warning = options.scoring === 'timed' && state.clock <= WARNING_SECONDS && !state.over;
      root.classList.toggle('is-warning', warning);
      fuse.show(state, warning);
    },
    bank(x, y, bounces) {
      if (bounces < 1) return;
      const tag = document.createElement('div');
      tag.className = 'td-bank';
      tag.textContent = bounces === 1 ? 'BANK' : `BANK ×${bounces}`;
      tag.style.left = `${x}px`;
      tag.style.top = `${y}px`;
      options.host.append(tag);
      tag.addEventListener('animationend', () => tag.remove());
    },
    setAppearance(next) {
      root.dataset.appearance = next;
    },
    dispose() {
      root.remove();
      announcer.remove();
      for (const tag of options.host.querySelectorAll('.td-bank')) tag.remove();
    },
  };
}

function plate(seat: HudSeat, side: Side): { element: HTMLElement; score: HTMLElement } {
  const element = document.createElement('div');
  element.className = 'td-hud-plate';
  element.dataset.side = String(side);
  const score = document.createElement('div');
  score.className = 'td-score';
  score.textContent = '0';
  const who = document.createElement('div');
  who.className = 'td-who';
  const name = document.createElement('div');
  name.className = 'td-name';
  name.textContent = seat.name;
  who.append(name);
  if (seat.note) {
    const note = document.createElement('div');
    note.className = 'td-note';
    note.textContent = seat.note;
    who.append(note);
  }
  element.append(score, who);
  return { element, score };
}

/** The clock: a fuse that burns from right to left for a timed round, ten pips for first to ten. */
function createFuse(scoring: ScoringRule): {
  element: HTMLElement;
  show: (state: MatchState, warning: boolean) => void;
} {
  const element = document.createElement('div');
  element.className = 'td-fuse';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 60');
  svg.setAttribute('preserveAspectRatio', 'none');
  element.append(svg);
  const line = 'M10 30 C 180 18, 320 42, 500 30 S 820 18, 990 30';

  if (scoring === 'first-to-10') {
    const pips: SVGCircleElement[] = [];
    for (let index = 0; index < 20; index++) {
      const pip = document.createElementNS(SVG, 'circle');
      // Ten pips per side, filling from the plates towards the middle.
      const fromLeft = index < 10;
      const x = fromLeft ? 40 + index * 44 : 960 - (index - 10) * 44;
      pip.setAttribute('cx', String(x));
      pip.setAttribute('cy', '30');
      pip.setAttribute('r', '9');
      pip.setAttribute('class', 'pip');
      svg.append(pip);
      pips.push(pip);
    }
    return {
      element,
      show(state) {
        pips.forEach((pip, index) => {
          const side = index < 10 ? 0 : 1;
          pip.classList.toggle('is-lit', state.scores[side] > index % 10);
        });
      },
    };
  }

  const cord = document.createElementNS(SVG, 'path');
  cord.setAttribute('d', line);
  cord.setAttribute('class', 'cord');
  const burnt = document.createElementNS(SVG, 'path');
  burnt.setAttribute('d', line);
  burnt.setAttribute('class', 'burnt');
  const spark = document.createElementNS(SVG, 'g');
  spark.setAttribute('class', 'spark');
  const core = document.createElementNS(SVG, 'circle');
  core.setAttribute('r', '7');
  core.setAttribute('fill', '#fff1c2');
  const flare = document.createElementNS(SVG, 'path');
  flare.setAttribute('d', 'M0 -16 L3 -3 L16 0 L3 3 L0 16 L-3 3 L-16 0 L-3 -3 Z');
  flare.setAttribute('fill', '#ffb347');
  spark.append(flare, core);
  svg.append(burnt, cord, spark);
  const length = cord.getTotalLength();
  burnt.style.strokeDasharray = `${length} ${length}`;

  let flicker = 0;
  return {
    element,
    show(state, warning) {
      const left = Math.max(0, state.clock) / ROUND_SECONDS;
      // The fuse burns from the right towards the left plate's side.
      const at = cord.getPointAtLength(length * left);
      cord.style.strokeDasharray = `2 3`;
      cord.style.clipPath = `inset(0 ${100 - left * 100}% 0 0)`;
      burnt.style.strokeDashoffset = String(-length * left);
      flicker += warning ? 0.55 : 0.2;
      const size = 0.8 + 0.35 * Math.abs(Math.sin(flicker));
      spark.setAttribute(
        'transform',
        `translate(${at.x} ${at.y}) rotate(${(flicker * 57) % 360}) scale(${size})`,
      );
      spark.style.display = state.over ? 'none' : '';
    },
  };
}
