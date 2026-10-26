/**
 * The chalkboard Versus Night keeps score on: a slate in a pine frame with
 * two names, chalk tallies for games won, a crown over the series winner,
 * and the dusty ghosts of earlier nights not quite rubbed out.
 *
 * Chalk is grainy: the whole face goes through a noise mask (chalkDefs), so
 * strokes break up where the stick skipped over the slate, and the ghosts
 * are blurred into dust rather than drawn as shapes.
 *
 * The same drawing serves the little board propped against the Den's TV
 * stand and the big one on the Versus Night screen, so the room and the
 * screen always agree. Everything chalk is drawn with slightly wobbly,
 * doubled strokes so it reads as chalk rather than as type.
 */
import { createRng } from '@woodgrain-88/kit';
import { escapeXml, n } from './svg.ts';

export interface ChalkboardScore {
  names: readonly [string, string];
  wins: readonly [number, number];
  bestOf: 3 | 5;
  /** The series winner, once there is one. */
  winner: 1 | 2 | null;
  /** The game being played or just drawn, written under the scores. */
  nowPlaying?: string;
}

const CHALK = '#f3efe4';

/** The chalk grain and the dust blur; any SVG that shows a chalkboard face includes these once. */
export function chalkDefs(): string {
  return (
    `<filter id="chalk-grain" x="-5%" y="-5%" width="110%" height="110%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise"/>` +
    `<feColorMatrix in="noise" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.9" result="holes"/>` +
    `<feComposite in="SourceGraphic" in2="holes" operator="in"/>` +
    `</filter>` +
    `<filter id="chalk-dust" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>`
  );
}

/** A chalk line: the stroke itself plus a fainter, offset second pass for the dusty edge. */
function chalkPath(d: string, width: number, seed: string): string {
  const rng = createRng(seed);
  const dx = n(rng.float(-0.5, 0.5));
  const dy = n(rng.float(-0.4, 0.4));
  return (
    `<path d="${d}" fill="none" stroke="${CHALK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.86"/>` +
    `<path d="${d}" transform="translate(${dx} ${dy})" fill="none" stroke="${CHALK}" stroke-width="${n(width * 1.6)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.16"/>`
  );
}

/** Tally marks, gates of five, starting at (x, y), each mark `height` tall. */
function tallies(count: number, x: number, y: number, height: number, seed: string): string {
  const rng = createRng(seed);
  let d = '';
  const gap = height * 0.34;
  for (let i = 0; i < count; i++) {
    const gate = Math.floor(i / 5);
    const inGate = i % 5;
    const left = x + gate * (gap * 5.4) + inGate * gap;
    if (inGate === 4) {
      // The fifth mark strikes through the four before it.
      const start = x + gate * (gap * 5.4) - gap * 0.4;
      d += `M${n(start)} ${n(y + height * 0.78)}L${n(start + gap * 4.2)} ${n(y + height * 0.2)}`;
    } else {
      d += `M${n(left + rng.float(-0.4, 0.4))} ${n(y)}L${n(left + rng.float(-0.6, 0.6))} ${n(y + height)}`;
    }
  }
  return d === '' ? '' : chalkPath(d, n(height * 0.13), seed);
}

function crown(cx: number, y: number, size: number): string {
  const s = size;
  return chalkPath(
    `M${n(cx - s)} ${n(y + s * 0.8)}L${n(cx - s * 0.9)} ${n(y)}L${n(cx - s * 0.4)} ${n(y + s * 0.45)}L${n(cx)} ${n(y - s * 0.15)}L${n(cx + s * 0.4)} ${n(y + s * 0.45)}L${n(cx + s * 0.9)} ${n(y)}L${n(cx + s)} ${n(y + s * 0.8)}Z`,
    n(size * 0.12),
    `crown-${cx}`,
  );
}

function chalkText(text: string, x: number, y: number, size: number, anchor: 'start' | 'middle' | 'end' = 'middle'): string {
  const safe = escapeXml(text);
  return (
    `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="var(--font-hand)" font-size="${n(size)}" fill="${CHALK}" opacity="0.88">${safe}</text>` +
    `<text x="${n(x + 0.4)}" y="${n(y + 0.3)}" text-anchor="${anchor}" font-family="var(--font-hand)" font-size="${n(size)}" fill="${CHALK}" opacity="0.18">${safe}</text>`
  );
}

/** Half-erased scribbles from earlier nights, so the slate never looks brand new. */
function ghosts(width: number, height: number): string {
  const rng = createRng('chalk-ghosts');
  let smudges = '';
  for (let i = 0; i < 7; i++) {
    smudges += `<ellipse cx="${n(rng.float(0, width))}" cy="${n(rng.float(0, height))}" rx="${n(rng.float(width * 0.08, width * 0.22))}" ry="${n(rng.float(height * 0.05, height * 0.12))}" fill="${CHALK}" opacity="${n(rng.float(0.04, 0.09))}"/>`;
  }
  return `<g filter="url(#chalk-dust)">${smudges}</g>` + chalkPath(`M${n(width * 0.62)} ${n(height * 0.78)}q${n(width * 0.08)} -${n(height * 0.06)} ${n(width * 0.16)} 0`, 1, 'ghost-line').replace(/opacity="0.86"/, 'opacity="0.12"');
}

/**
 * The slate's content on a `width`×`height` area at the origin (the frame is
 * the caller's). Without a score it shows the night's title and an invitation.
 */
export function chalkboardFace(width: number, height: number, score: ChalkboardScore | null): string {
  // A big board shows the chalk's grain and a note in the corner; on the little
  // board in the Den both would only blur the score.
  const roomy = width > 300;
  const grainy = (markup: string) => (roomy ? `<g filter="url(#chalk-grain)">${markup}</g>` : markup);
  const title = chalkText('VERSUS NIGHT', width / 2, height * 0.16, height * 0.12);
  if (score === null) {
    return grainy(ghosts(width, height) + title + chalkText('who is next?', width / 2, height * 0.56, height * 0.14) + chalkPath(`M${n(width * 0.3)} ${n(height * 0.68)}h${n(width * 0.4)}`, n(height * 0.012), 'underline'));
  }
  const rowHeight = height * 0.26;
  const rows = [0, 1].map((seat) => {
    const y = height * 0.3 + seat * rowHeight;
    const name = score.names[seat] ?? '';
    const isWinner = score.winner === seat + 1;
    return (
      chalkText(name.length > 12 ? `${name.slice(0, 11)}…` : name, width * 0.12, y + rowHeight * 0.55, rowHeight * 0.46, 'start') +
      tallies(score.wins[seat] ?? 0, width * 0.6, y + rowHeight * 0.08, rowHeight * 0.74, `tally-${seat}`) +
      (isWinner ? crown(width * 0.12 + name.length * rowHeight * 0.13, y - rowHeight * 0.05, rowHeight * 0.22) : '')
    );
  });
  const divider = chalkPath(`M${n(width * 0.52)} ${n(height * 0.3)}V${n(height * 0.82)}`, n(height * 0.01), 'divider');
  const footer = score.nowPlaying ? chalkText(`now: ${score.nowPlaying}`, width / 2, height * 0.94, height * 0.09) : '';
  // How long the night is, written small in the corner the way a scorer would.
  const length = !roomy ? '' : chalkText(`best of ${score.bestOf}`, width * 0.94, height * 0.12, height * 0.06, 'end') + chalkPath(`M${n(width * 0.78)} ${n(height * 0.145)}h${n(width * 0.16)}`, n(height * 0.006), 'length-line');
  return grainy(ghosts(width, height) + title + length + divider + rows.join('') + footer);
}

/** The little board in the Den, leaning back against the stand. */
export function denChalkboard(rect: { x: number; y: number; width: number; height: number }, score: ChalkboardScore | null): string {
  const { x, y, width, height } = rect;
  const frame = 7;
  // Leaning back: the top edge sits a little narrower than the bottom.
  const lean = 6;
  const outline = `M${x + lean} ${y}H${x + width - lean}L${x + width} ${y + height}H${x}Z`;
  const inner = `M${x + lean + frame} ${y + frame}H${x + width - lean - frame}L${x + width - frame} ${y + height - frame}H${x + frame}Z`;
  const faceW = width - frame * 2 - lean;
  const faceH = height - frame * 2;
  return (
    `<g class="chalkboard">` +
    `<ellipse cx="${x + width / 2}" cy="${y + height + 3}" rx="${width / 2 + 6}" ry="6" fill="#000" opacity="0.35"/>` +
    `<path d="${outline}" fill="#b07a42"/>` +
    `<path d="${outline}" fill="url(#den-pine)" opacity="0.6"/>` +
    `<path d="${inner}" fill="#24302b"/>` +
    `<path d="${inner}" fill="url(#den-slate)"/>` +
    `<g transform="translate(${x + frame + lean / 2} ${y + frame}) scale(1 1)">${chalkboardFace(faceW, faceH, score)}</g>` +
    // A stub of chalk and a felt eraser on the frame's ledge.
    `<rect x="${x + 16}" y="${y + height - 6}" width="12" height="3" rx="1.5" fill="${CHALK}"/>` +
    `<rect x="${x + width - 34}" y="${y + height - 8}" width="20" height="5" rx="1" fill="#3b3b44"/><rect x="${x + width - 34}" y="${y + height - 8}" width="20" height="2" rx="1" fill="#8a6a3a"/>` +
    `</g>`
  );
}
