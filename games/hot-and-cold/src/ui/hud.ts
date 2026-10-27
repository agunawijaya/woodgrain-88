/**
 * The match HUD, dressed for the look it sits over: enamel name cards on the
 * snowfield, cream score cards on the tabletop, console readouts on the
 * radar. Two seat plates on the top edge (one when hunting alone) and, in
 * the middle, what the match is played to: the goal, the clock, whose turn
 * it is. Below, one line at a time says what just happened (a bump, a bomb,
 * a flag), and a marker stands over the square the mouse is walking to.
 */
import type { Appearance } from '@woodgrain-88/kit';
import type { Match, Seat } from '../engine/match.ts';
import { DISPLAY_FONT, LEGIBLE_FONT, SERIF_FONT } from '../look/glyphs.ts';
import type { LookId, SeatColours } from '../look/look.ts';

export interface HudSeat {
  readonly name: string;
  /** Small print under the name: the keys, "Switch A", or the Kid's way of playing. */
  readonly note: string;
  readonly colours: SeatColours;
}

export interface HudOptions {
  readonly host: HTMLElement;
  readonly look: LookId;
  readonly seats: readonly [HudSeat, HudSeat];
  readonly appearance: Appearance;
  readonly reducedMotion: boolean;
  /** Classic Memory gets a small reminder under the goal. */
  readonly classic: boolean;
}

export type MessageTone = 'plain' | 'alert' | 'joy';

export interface Hud {
  update(match: Match): void;
  /** One line about what just happened, edged in the colour of the seat it is about; it fades. */
  say(text: string, tone?: MessageTone, seat?: Seat): void;
  /** The mouse's walk target at (x, y) CSS pixels inside the host, or null to hide it. */
  mark(point: { readonly x: number; readonly y: number } | null, seat: Seat): void;
  setAppearance(appearance: Appearance): void;
  dispose(): void;
}

const MESSAGE_SECONDS = 2.6;
/** The clock's last stretch, when the readout turns urgent. */
const CLOCK_WARNING = 10;

const STYLE = /* css */ `
.hc-hud {
  --face: ${DISPLAY_FONT};
  --small: ${LEGIBLE_FONT};
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  color: var(--ink);
}
.hc-hud[data-look='polar'] {
  --ink: #12263f;
  --soft: #4b6584;
  --plate: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(232, 242, 252, 0.92));
  --plate-edge: rgba(255, 255, 255, 0.9);
  --plate-shadow: 0 6px 18px rgba(30, 60, 100, 0.22), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  --radius: 14px;
  --urgent: #c4252f;
}
.hc-hud[data-look='polar'][data-appearance='dark'] {
  --ink: #eaf4ff;
  --soft: #a9c2df;
  --plate: linear-gradient(180deg, rgba(22, 36, 62, 0.9), rgba(10, 20, 40, 0.86));
  --plate-edge: rgba(150, 200, 255, 0.28);
  --plate-shadow: 0 0 24px rgba(90, 160, 255, 0.18), 0 8px 20px rgba(0, 0, 0, 0.5);
  --urgent: #ff7a7a;
}
.hc-hud[data-look='tabletop'] {
  --face: ${SERIF_FONT};
  --ink: #3a2412;
  --soft: #7a5a3c;
  --plate: linear-gradient(180deg, #fbf3e0, #efe0bf);
  --plate-edge: #c9ab78;
  --plate-shadow: 0 2px 0 #b8955e, 0 8px 16px rgba(60, 35, 10, 0.3);
  --radius: 6px;
  --urgent: #a3231a;
}
.hc-hud[data-look='tabletop'][data-appearance='dark'] {
  --ink: #2c1a0b;
  --soft: #6b4a2b;
  --plate: radial-gradient(140% 120% at 30% 0%, #f7e8c6, #d9c094);
  --plate-edge: #a88655;
  --plate-shadow: 0 2px 0 #80623a, 0 10px 26px rgba(0, 0, 0, 0.7);
  --urgent: #9b1d14;
}
.hc-hud[data-look='radar'] {
  --ink: #1d3a2b;
  --soft: #4f6e5c;
  --plate: linear-gradient(180deg, #e7efe6, #d6e2d6);
  --plate-edge: #9fb5a3;
  --plate-shadow: 0 1px 0 #fff inset, 0 3px 10px rgba(30, 60, 40, 0.25);
  --radius: 4px;
  --urgent: #b3261e;
}
.hc-hud[data-look='radar'][data-appearance='dark'] {
  --ink: #8dffb4;
  --soft: #4fbf7c;
  --plate: linear-gradient(180deg, rgba(4, 20, 10, 0.9), rgba(2, 12, 6, 0.88));
  --plate-edge: rgba(110, 255, 160, 0.35);
  --plate-shadow: 0 0 18px rgba(60, 255, 130, 0.16);
  --urgent: #ff6a5a;
}
.hc-hud[data-look='radar'][data-appearance='dark'] .hc-score,
.hc-hud[data-look='radar'][data-appearance='dark'] .hc-headline {
  text-shadow: 0 0 10px rgba(110, 255, 160, 0.55);
}
.hc-top {
  position: absolute;
  inset: 0 0 auto 0;
  height: 10vh;
  min-height: 64px;
  display: grid;
  grid-template-columns: minmax(170px, 24%) 1fr minmax(170px, 24%);
  align-items: center;
  gap: 2vw;
  /* Clear of the Hall's pause button (top right) on both sides, so neither plate is favoured. */
  padding: 0 max(2.5vw, 112px);
}
.hc-plate {
  position: relative;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 0.75em;
  height: 74%;
  padding: 0 0.9em 0 0;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--plate);
  border: 1px solid var(--plate-edge);
  box-shadow: var(--plate-shadow);
  font-family: var(--face);
  transition: transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease;
}
.hc-plate::before { content: ''; align-self: stretch; background: var(--seat); }
.hc-plate[data-seat='1'] { grid-template-columns: auto 1fr 10px; padding: 0 0 0 0.9em; }
.hc-plate[data-seat='1']::before { order: 3; }
.hc-plate[data-seat='1'] .hc-who { order: 2; text-align: right; }
.hc-plate[data-seat='1'] .hc-tally { order: 1; }
.hc-plate[hidden] { display: none; }
.hc-plate.is-waiting { opacity: 0.62; }
.hc-plate.is-active {
  transform: translateY(3px);
  box-shadow: var(--plate-shadow), 0 0 0 3px var(--seat);
}
.hc-who { display: grid; gap: 1px; min-width: 0; }
.hc-name {
  font-size: clamp(16px, 2.3vh, 26px);
  font-weight: 800;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hc-hud[data-look='polar'] .hc-name, .hc-hud[data-look='radar'] .hc-name { text-transform: uppercase; }
.hc-note {
  font-family: var(--small);
  font-size: clamp(11px, 1.35vh, 14px);
  font-weight: 600;
  color: var(--soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hc-tally { display: grid; justify-items: center; line-height: 1; }
.hc-score {
  font-size: clamp(30px, 5.4vh, 60px);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  min-width: 1.3em;
  text-align: center;
}
.hc-unit {
  font-family: var(--small);
  font-size: clamp(10px, 1.2vh, 13px);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--soft);
}
.hc-centre {
  justify-self: center;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 0.4em 1.2em;
  border-radius: var(--radius);
  background: var(--plate);
  border: 1px solid var(--plate-edge);
  box-shadow: var(--plate-shadow);
  font-family: var(--face);
  text-align: center;
}
.hc-headline {
  font-size: clamp(18px, 2.8vh, 32px);
  font-weight: 800;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.hc-hud[data-look='tabletop'] .hc-headline { letter-spacing: 0.01em; }
.hc-detail {
  font-family: var(--small);
  font-size: clamp(11px, 1.4vh, 15px);
  font-weight: 700;
  color: var(--soft);
  white-space: nowrap;
}
.hc-detail:empty { display: none; }
.hc-centre.is-urgent .hc-headline { color: var(--urgent); }
.hc-message {
  position: absolute;
  left: 50%;
  bottom: max(3vh, 20px);
  transform: translateX(-50%);
  max-width: min(88vw, 720px);
  padding: 0.55em 1.2em;
  border-radius: 999px;
  background: var(--plate);
  border: 1px solid var(--plate-edge);
  box-shadow: var(--plate-shadow);
  font-family: var(--small);
  font-size: clamp(15px, 2.1vh, 22px);
  font-weight: 700;
  text-align: center;
  opacity: 0;
  transition: opacity 240ms ease, transform 240ms ease;
}
.hc-message.is-shown { opacity: 1; transform: translateX(-50%) translateY(-4px); }
.hc-message[data-tone='alert'] { color: var(--urgent); }
.hc-message[style*='--seat'] { box-shadow: var(--plate-shadow), 0 0 0 3px var(--seat); }
.hc-marker {
  position: absolute;
  width: 26px;
  height: 30px;
  margin: -34px 0 0 -13px;
  color: var(--seat);
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.35));
  animation: hc-marker 0.9s ease-in-out infinite alternate;
}
.hc-marker[hidden] { display: none; }
@keyframes hc-marker { from { translate: 0 -4px; } to { translate: 0 2px; } }
@media (prefers-reduced-motion: reduce) {
  .hc-marker { animation: none; }
  .hc-plate, .hc-message { transition: none; }
}
@media (max-width: 720px) {
  .hc-top { grid-template-columns: 1fr 1fr; padding: 0 64px 0 12px; gap: 8px; }
  .hc-centre { grid-column: 1 / -1; grid-row: 2; }
}
`;

interface Plate {
  readonly element: HTMLElement;
  readonly score: HTMLElement;
  readonly unit: HTMLElement;
  shown: number;
}

export function createHud(options: HudOptions): Hud {
  const root = document.createElement('div');
  root.className = 'hc-hud';
  root.dataset.look = options.look;
  root.dataset.appearance = options.appearance;
  root.setAttribute('aria-hidden', 'true');
  const style = document.createElement('style');
  style.textContent = STYLE;

  const top = document.createElement('div');
  top.className = 'hc-top';
  const plates = options.seats.map((seat, index) => createPlate(seat, index as Seat)) as [
    Plate,
    Plate,
  ];
  const centre = document.createElement('div');
  centre.className = 'hc-centre';
  const headline = document.createElement('div');
  headline.className = 'hc-headline';
  const detail = document.createElement('div');
  detail.className = 'hc-detail';
  centre.append(headline, detail);
  top.append(plates[0].element, centre, plates[1].element);

  const message = document.createElement('div');
  message.className = 'hc-message';
  const marker = createMarker();
  root.append(style, top, message, marker);
  options.host.append(root);

  // The HUD is a picture; what it says is also said aloud for screen readers.
  const announcer = document.createElement('p');
  announcer.setAttribute('role', 'status');
  announcer.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
  options.host.append(announcer);

  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  function setText(element: HTMLElement, text: string): void {
    if (element.textContent !== text) element.textContent = text;
  }

  function showScore(plate: Plate, value: number): void {
    if (value === plate.shown) return;
    const rose = value > plate.shown;
    plate.shown = value;
    plate.score.textContent = String(value);
    if (rose && !options.reducedMotion) {
      plate.score.animate(
        [
          { transform: 'scale(1.45)', offset: 0 },
          { transform: 'scale(0.94)', offset: 0.6 },
          { transform: 'none' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' },
      );
    }
  }

  function readout(match: Match): { headline: string; detail: string; urgent: boolean } {
    const { rules } = match;
    const alone = match.setup.seats === 1;
    const name = (seat: Seat) => options.seats[seat].name;
    const memory = options.classic ? 'Classic Memory' : '';
    if (rules.singleHunt) return { headline: 'Find the flag', detail: memory, urgent: false };
    switch (rules.style) {
      case 'clock': {
        const left = match.clock.remaining;
        return { headline: `Clock ${left}`, detail: memory, urgent: left <= CLOCK_WARNING };
      }
      case 'hunts': {
        if (alone) {
          const left = Math.max(0, rules.goal - match.seats[0].score);
          return { headline: `${left} checks left`, detail: memory, urgent: left <= CLOCK_WARNING };
        }
        const hunting = match.finalTurn
          ? `Last hunt: ${name(match.hunter)}`
          : `${name(match.hunter)} hunts`;
        return { headline: `Fewest checks · ${rules.goal}`, detail: hunting, urgent: false };
      }
      case 'turns':
        return {
          headline: `First to ${rules.goal}`,
          detail: `${name(match.turn)}’s turn`,
          urgent: false,
        };
      case 'race':
        return { headline: `First to ${rules.goal}`, detail: memory, urgent: false };
    }
  }

  return {
    update(match) {
      const alone = match.setup.seats === 1;
      const counting = match.rules.style === 'hunts' || match.rules.singleHunt;
      plates.forEach((plate, index) => {
        const seat = index as Seat;
        const state = match.seats[seat];
        plate.element.hidden = alone && seat === 1;
        // Hunt for hunt counts checks as they are let go (twice on switch A); the daily's single
        // hunt ends on the flag, so it shows the checks made.
        showScore(plate, match.rules.singleHunt ? state.checks : state.score);
        setText(plate.unit, counting ? 'checks' : 'flags');
        const turnTaking = match.rules.style === 'turns' || match.rules.style === 'hunts';
        const theirs = match.rules.style === 'turns' ? match.turn : match.hunter;
        plate.element.classList.toggle('is-active', !alone && turnTaking && theirs === seat);
        plate.element.classList.toggle('is-waiting', !alone && turnTaking && theirs !== seat);
      });
      const now = readout(match);
      setText(headline, now.headline);
      setText(detail, now.detail);
      centre.classList.toggle('is-urgent', now.urgent);
    },
    say(text, tone = 'plain', seat) {
      message.textContent = text;
      message.dataset.tone = tone;
      if (seat === undefined) message.style.removeProperty('--seat');
      else message.style.setProperty('--seat', options.seats[seat].colours.main);
      message.classList.add('is-shown');
      announcer.textContent = text;
      if (messageTimer !== null) clearTimeout(messageTimer);
      messageTimer = setTimeout(() => message.classList.remove('is-shown'), MESSAGE_SECONDS * 1000);
    },
    mark(point, seat) {
      marker.hidden = point === null;
      if (!point) return;
      marker.style.left = `${point.x}px`;
      marker.style.top = `${point.y}px`;
      marker.style.setProperty('--seat', options.seats[seat].colours.main);
    },
    setAppearance(next) {
      root.dataset.appearance = next;
    },
    dispose() {
      if (messageTimer !== null) clearTimeout(messageTimer);
      root.remove();
      announcer.remove();
    },
  };
}

function createPlate(seat: HudSeat, index: Seat): Plate {
  const element = document.createElement('div');
  element.className = 'hc-plate';
  element.dataset.seat = String(index);
  element.style.setProperty('--seat', seat.colours.main);
  const who = document.createElement('div');
  who.className = 'hc-who';
  const name = document.createElement('div');
  name.className = 'hc-name';
  name.textContent = seat.name;
  who.append(name);
  if (seat.note) {
    const note = document.createElement('div');
    note.className = 'hc-note';
    note.textContent = seat.note;
    who.append(note);
  }
  const tally = document.createElement('div');
  tally.className = 'hc-tally';
  const score = document.createElement('div');
  score.className = 'hc-score';
  score.textContent = '0';
  const unit = document.createElement('div');
  unit.className = 'hc-unit';
  tally.append(score, unit);
  element.append(who, tally);
  return { element, score, unit, shown: 0 };
}

/** A small downward pennant-pin over the target square, in the walking seat's colour. */
function createMarker(): HTMLElement {
  const marker = document.createElement('div');
  marker.className = 'hc-marker';
  marker.hidden = true;
  marker.innerHTML =
    '<svg viewBox="0 0 26 30" width="26" height="30" aria-hidden="true">' +
    '<path d="M13 29 L4 13 A10 10 0 1 1 22 13 Z" fill="currentColor" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle cx="13" cy="10" r="3.6" fill="#fff"/></svg>';
  return marker;
}
