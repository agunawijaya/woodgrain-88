/**
 * The white cat asleep on the carpet beside the beanbag, curled up with its
 * chin on its paws and its tail wrapped round the front.
 *
 * Drawn in its own 180×100 box and placed by LAYOUT.cat. The fur is built up
 * in layers rather than one flat shape: a warm white body lit from the window,
 * a cool shade low on the flank and a little warm bounce from the carpet,
 * soft tufts along the back so the outline reads as fur, tapered seeded
 * strands that follow the lie of the coat, a shadowed haunch, and a darker
 * crescent where the head rests against the body. The body breathes and the
 * far ear flicks now and then (both off with reduced motion).
 */
import { createRng, type Rng } from '@woodgrain-88/kit';
import { LAYOUT } from './geometry.ts';
import { n } from './svg.ts';

interface Point {
  x: number;
  y: number;
}

type Cubic = readonly [Point, Point, Point, Point];

const p = (x: number, y: number): Point => ({ x, y });

// The back, from the nape over the shoulders, a slight dip, the haunch and
// round the rump. Tufts and strands are scattered along it, so it is data.
const BACK: readonly Cubic[] = [
  [p(62, 36), p(72, 27), p(84, 22), p(98, 21)],
  [p(98, 21), p(110, 20), p(120, 23.5), p(132, 22.5)],
  [p(132, 22.5), p(152, 20), p(170, 32), p(176, 50)],
  [p(176, 50), p(182, 66), p(180, 84), p(172, 94)],
];

function pointOn([a, b, c, d]: Cubic, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function tangentOn([a, b, c, d]: Cubic, t: number): Point {
  const u = 1 - t;
  const x = 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x);
  const y = 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

// The outline runs clockwise on screen, so the inside is to the right of travel.
const inwardOf = (along: Point): Point => ({ x: -along.y, y: along.x });

const curve = ([, b, c, d]: Cubic) => `C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`;

const BODY = `M30 94C26 72 40 46 62 36${BACK.map(curve).join('')}C164 99 146 99 128 99L40 99Z`;

const THIGH = 'M144 40C133 50 127 64 129 78C130 87 135 93 142 96';

const TAIL =
  'M176 84C170 98 140 106 104 104C88 103 74 101 66 97C60 94 57 89 60 85' +
  'C62 82 67 82 69 85C72 89 82 92 98 93C126 95 152 91 168 76Z';

// The underside of the tail, from the rump round to the tip.
const TAIL_UNDERSIDE: readonly Cubic[] = [
  [p(176, 84), p(170, 98), p(140, 106), p(104, 104)],
  [p(104, 104), p(88, 103), p(74, 101), p(66, 97)],
];

/** Walks an outline, calling `draw` at evenly spread, slightly jittered places. */
function alongOutline(
  outline: readonly Cubic[],
  rng: Rng,
  perSegment: number,
  draw: (edge: Point, along: Point) => string,
): string {
  let d = '';
  for (const segment of outline) {
    for (let i = 0; i < perSegment; i++) {
      const t = (i + rng.float(0.15, 0.85)) / perSegment;
      d += draw(pointOn(segment, t), tangentOn(segment, t));
    }
  }
  return d;
}

/**
 * Soft locks standing just proud of the outline, each leaning towards the
 * tail with a rounded tip, so the edge reads as a coat rather than a line.
 */
function tufts(outline: readonly Cubic[], seed: string, perSegment: number): string {
  const rng = createRng(seed);
  return alongOutline(outline, rng, perSegment, (edge, along) => {
    const out = { x: along.y, y: -along.x };
    const half = rng.float(2.6, 4.2);
    const lift = rng.float(0.9, 2);
    const lean = rng.float(1.2, 2.6);
    const at = (forward: number, up: number) => ({
      x: edge.x + along.x * forward + out.x * up,
      y: edge.y + along.y * forward + out.y * up,
    });
    const a = at(-half, -0.8);
    const b = at(half, -0.8);
    const tip = at(lean, lift);
    const c1 = at(-half * 0.4, lift * 0.95);
    const c2 = at(lean - 0.9, lift * 1.05);
    const c3 = at(lean + 0.8, lift * 0.9);
    const c4 = at(half * 0.8, lift * 0.3);
    return `M${n(a.x)} ${n(a.y)}C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(tip.x)} ${n(tip.y)}C${n(c3.x)} ${n(c3.y)} ${n(c4.x)} ${n(c4.y)} ${n(b.x)} ${n(b.y)}Z`;
  });
}

/** Tapered strands inside the coat: grey ones lower down, white ones near the top. */
function strands(minDepth: number, maxDepth: number, seed: string, perSegment: number): string {
  const rng = createRng(seed);
  return alongOutline(BACK, rng, perSegment, (edge, along) => {
    const inward = inwardOf(along);
    const depth = rng.float(minDepth, maxDepth);
    const length = rng.float(5, 10);
    const width = rng.float(0.7, 1.2);
    const start = { x: edge.x + inward.x * depth, y: edge.y + inward.y * depth };
    const end = { x: start.x + along.x * length, y: start.y + along.y * length };
    const belly = { x: start.x + along.x * length * 0.35, y: start.y + along.y * length * 0.35 };
    return (
      `M${n(start.x)} ${n(start.y)}` +
      `Q${n(belly.x + inward.x * width)} ${n(belly.y + inward.y * width)} ${n(end.x)} ${n(end.y)}` +
      `Q${n(belly.x - inward.x * width * 0.4)} ${n(belly.y - inward.y * width * 0.4)} ${n(start.x)} ${n(start.y)}Z`
    );
  });
}

export function catDefs(): string {
  return `
    <radialGradient id="den-cat-fur" cx="84" cy="26" r="150" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.38" stop-color="#f8f4f1"/>
      <stop offset="0.72" stop-color="#e2d9d5"/>
      <stop offset="1" stop-color="#cfc5c2"/>
    </radialGradient>
    <radialGradient id="den-cat-face" cx="0.42" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.6" stop-color="#f6f1ee"/>
      <stop offset="1" stop-color="#dbd0cb"/>
    </radialGradient>
    <radialGradient id="den-cat-cool" cx="150" cy="92" r="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8f93a8" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#8f93a8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="den-cat-underside" x1="0" y1="60" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7d6a64" stop-opacity="0"/>
      <stop offset="1" stop-color="#7d6a64" stop-opacity="0.38"/>
    </linearGradient>
    <linearGradient id="den-cat-tail" x1="0" y1="82" x2="0" y2="105" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fdfbfa"/>
      <stop offset="0.55" stop-color="#eee7e3"/>
      <stop offset="1" stop-color="#cdc1bc"/>
    </linearGradient>
    <linearGradient id="den-cat-ear" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7cfcf"/>
      <stop offset="1" stop-color="#e5959b"/>
    </linearGradient>
    <linearGradient id="den-cat-thigh" x1="0" y1="40" x2="0" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#a39494" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#a39494" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#a39494" stop-opacity="0.34"/>
    </linearGradient>
    <radialGradient id="den-cat-ground" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000" stop-opacity="0.42"/>
      <stop offset="0.7" stop-color="#000" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="den-cat-body-clip"><path d="${BODY}"/></clipPath>`;
}

function body(): string {
  return (
    `<g class="cat-breath">` +
    `<path d="${tufts(BACK, 'den-cat-tufts', 6)}" fill="url(#den-cat-fur)"/>` +
    `<path d="${BODY}" fill="url(#den-cat-fur)"/>` +
    `<g clip-path="url(#den-cat-body-clip)">` +
    // The folded hind leg: a soft shadow along the front of the thigh, fading
    // out towards the back, down to the knee.
    `<path d="${THIGH}" fill="none" stroke="url(#den-cat-thigh)" stroke-width="9" stroke-linecap="round"/>` +
    `<rect x="60" y="40" width="130" height="70" fill="url(#den-cat-cool)"/>` +
    `<path d="${strands(7, 24, 'den-cat-strands', 10)}" fill="#bfb2ad" opacity="0.5"/>` +
    `<path d="${strands(2, 9, 'den-cat-sheen', 7)}" fill="#fff" opacity="0.9"/>` +
    `<rect x="0" y="0" width="190" height="110" fill="url(#den-cat-underside)"/>` +
    // Warm light bounced up from the carpet along the very bottom.
    `<path d="M44 98.5H150" stroke="#ffb27a" stroke-width="3" opacity="0.3"/>` +
    `</g>` +
    `</g>`
  );
}

function tail(): string {
  return (
    // Where the tail lies against the body, a soft contact shadow.
    `<path d="M168 79C150 92 124 95 98 94C84 93 76 90 69 87" fill="none" stroke="#9f8c86" stroke-width="3" stroke-linecap="round" opacity="0.3"/>` +
    `<path d="${tufts(TAIL_UNDERSIDE, 'den-cat-tail-tufts', 5)}" fill="url(#den-cat-tail)"/>` +
    `<path d="${TAIL}" fill="url(#den-cat-tail)"/>` +
    // Strands combed along the tail, and the light on its upper side.
    `<path d="M166 88q-10 6 -22 8.5M150 96q-12 3.5 -26 4M132 99.5q-12 1.6 -24 1.2M112 100.5q-11 0 -22 -1.8M94 97.8q-9 -0.8 -17 -3M76 95.5q-6 -1.6 -10 -4.5" fill="none" stroke="#c2b4af" stroke-width="0.9" stroke-linecap="round" opacity="0.65"/>` +
    `<path d="M71 88C78 90.5 86 92.5 98 93.2C122 95 146 91.5 164 80" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity="0.55"/>`
  );
}

function paws(): string {
  const paw = (x: number, y: number, w: number) =>
    `<path d="M${x} ${y + 6}C${x} ${y} ${x + w * 0.4} ${y - 2} ${x + w * 0.8} ${y}C${x + w * 1.05} ${y + 2} ${x + w * 1.05} ${y + 10} ${x + w * 0.75} ${y + 12}C${x + w * 0.4} ${y + 13.5} ${x} ${y + 12} ${x} ${y + 6}Z" fill="url(#den-cat-tail)"/>` +
    `<path d="M${x + w * 0.28} ${y + 7.5}q0.6 2.4 0 4.2M${x + w * 0.52} ${y + 7.8}q0.6 2.4 0 4.2" fill="none" stroke="#b9aaa4" stroke-width="0.8" stroke-linecap="round"/>`;
  return paw(20, 85, 22) + paw(42, 87, 21);
}

function ears(): string {
  return (
    // Near ear, on the viewer's left.
    `<path d="M26 48C22 38 21 29 24 21C26 19.5 28 20 30 21.5C37 27 42 33 45 40Z" fill="url(#den-cat-face)"/>` +
    `<path d="M29 44C27 37 26.5 31 27.5 26C32 29.5 36 34 39 39Z" fill="url(#den-cat-ear)"/>` +
    `<path d="M30 42q1.5 -5 0.5 -10M33 41q1 -4 0 -7.5" fill="none" stroke="#fff" stroke-width="0.7" stroke-linecap="round" opacity="0.9"/>` +
    // Far ear: the one that flicks.
    `<g class="cat-ear">` +
    `<path d="M53 39C57 31 63 24 70 19.5C72 19 73.5 20 74 22C75 30 74 38 71 46Z" fill="url(#den-cat-face)"/>` +
    `<path d="M57 39.5C60 33.5 64.5 28 69.5 24.5C70.5 30 70 36 68 42Z" fill="url(#den-cat-ear)"/>` +
    `<path d="M62 38q2 -4.5 4 -7.5M64.5 40q1.5 -3.5 3 -6" fill="none" stroke="#fff" stroke-width="0.7" stroke-linecap="round" opacity="0.9"/>` +
    `</g>`
  );
}

function head(): string {
  // Round, wide cheeks with a few tufts so the face reads as fur, not a disc.
  const shape =
    'M22 70C17 57 22 45 34 40.5C43 37 57 36.5 66 41C76 46 80 57 78 66' +
    'C80 68 81.5 70.5 80.5 72C79 71.5 78 71.5 77 72C74.5 78 68 82.5 58 84.5' +
    'C47 86.5 33 85 26 80C24 80.5 21.5 80 20 78.5C21 77.5 22 76.5 22.5 75.5C21.5 74 21.2 72 22 70Z';
  return (
    // The head's shadow on the body behind it.
    `<path d="M64 42C80 46 88 62 84 82C80 86 74 87 70 86C78 72 76 56 64 42Z" fill="#b5a5a0" opacity="0.45"/>` +
    ears() +
    `<path d="${shape}" fill="url(#den-cat-face)"/>` +
    // Cheek and chin fluff, and a faint warmth on the cheeks.
    `<path d="M26 78q4 2 8 2.5M70 80q-4 2.5 -9 3.2M47 85.5q3 -0.6 6 -0.4" fill="none" stroke="#c9bcb7" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>` +
    `<ellipse cx="31" cy="69" rx="5" ry="3" fill="#f4b9bc" opacity="0.28"/>` +
    `<ellipse cx="66" cy="68.5" rx="5" ry="3" fill="#f4b9bc" opacity="0.28"/>` +
    `<path d="M36 44q8 -3 18 -2.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>` +
    // Closed eyes, a pink nose and the little split of the mouth.
    `<path d="M30.5 59.5Q35.5 64 41.5 60.5M54 60Q59.5 64 64.5 59.2" fill="none" stroke="#6b5b5f" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M29.5 58.2l-1.6 -0.8M65.4 58l1.6 -0.9" fill="none" stroke="#6b5b5f" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M45 66.2C46.6 65.5 49.4 65.5 51 66.2C50.6 67.8 49.2 69 48 69.2C46.8 69 45.4 67.8 45 66.2Z" fill="#e8939a"/>` +
    `<path d="M48 69.2V70.6M48 70.6Q46.2 72.6 44 71.6M48 70.6Q49.8 72.6 52 71.6" fill="none" stroke="#b7868b" stroke-width="0.85" stroke-linecap="round"/>` +
    // Whiskers, grey enough to read against the carpet and the white cheeks.
    `<path d="M41 68.5Q30 66 15 67.5M41 70.5Q30 70.5 16 74M41.5 72.5Q32 75 20 80.5M55 68.3Q66 65 81 64.8M55 70.3Q67 69.5 82 72M54.5 72.3Q65 75 77 80" fill="none" stroke="#9c8c87" stroke-width="0.6" stroke-linecap="round" opacity="0.75"/>`
  );
}

/** The cat at `rect`: by the first beanbag, or curled on the second once it arrives. */
export function cat(rect: { x: number; y: number; width: number } = LAYOUT.cat): string {
  const { x, y, width } = rect;
  const scale = width / 180;
  return (
    `<g class="cat" aria-hidden="true" transform="translate(${x} ${y}) scale(${n(scale)})">` +
    `<ellipse cx="100" cy="97" rx="96" ry="9" fill="url(#den-cat-ground)"/>` +
    `<ellipse cx="96" cy="98.5" rx="76" ry="3" fill="#000" opacity="0.22"/>` +
    body() +
    tail() +
    paws() +
    `<g class="cat-head">${head()}</g>` +
    `</g>`
  );
}
