/**
 * Paper Sky's drawings, each made once on a canvas with crayon.ts: the sheet
 * of graph paper with its pencilled spiral round the sun and its border, the
 * smiling sun, the two crayon rockets and their scribbled flames, the pencil
 * dash a missile is, and the zigzag starburst of a hit. Each drawing that
 * boils comes in three versions drawn with different seeds.
 */
import type { Rng } from '@woodgrain-88/kit';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/field.ts';
import type { Seat, SeatColours } from '../../look/look.ts';
import { circle, crayonFill, crayonLine, createPad, type Pad, type Point } from './crayon.ts';

/** The sheet, in drawing units: the field and a margin round it. */
export const SHEET_WIDTH = 48;
export const SHEET_DEPTH = 30;
const SHEET_SCALE = 40;

/** Graph paper: blue lines every unit, bolder every four, a pencilled border and the spiral. */
export function drawSheet(
  rng: Rng,
  options: { readonly spiral: boolean; readonly solidEdges: boolean; readonly night: boolean },
): Pad {
  const pad = createPad(SHEET_WIDTH, SHEET_DEPTH, SHEET_SCALE);
  const { context } = pad;
  context.fillStyle = options.night ? '#eef0f4' : '#fbf8ef';
  context.fillRect(-SHEET_WIDTH / 2, -SHEET_DEPTH / 2, SHEET_WIDTH, SHEET_DEPTH);
  // The paper's own fibres, a scatter of faint flecks.
  for (let fleck = 0; fleck < 9000; fleck++) {
    context.fillStyle = `rgba(120, 110, 90, ${rng.float(0.02, 0.06).toFixed(3)})`;
    context.fillRect(
      rng.float(-SHEET_WIDTH / 2, SHEET_WIDTH / 2),
      rng.float(-SHEET_DEPTH / 2, SHEET_DEPTH / 2),
      rng.float(0.02, 0.06),
      rng.float(0.02, 0.06),
    );
  }
  for (let x = -SHEET_WIDTH / 2; x <= SHEET_WIDTH / 2; x += 1) {
    const major = Math.round(x) % 4 === 0;
    context.strokeStyle = major ? 'rgba(84, 136, 200, 0.55)' : 'rgba(110, 160, 215, 0.35)';
    context.lineWidth = major ? 0.045 : 0.025;
    context.beginPath();
    context.moveTo(x, -SHEET_DEPTH / 2);
    context.lineTo(x, SHEET_DEPTH / 2);
    context.stroke();
  }
  for (let y = -SHEET_DEPTH / 2; y <= SHEET_DEPTH / 2; y += 1) {
    const major = Math.round(y) % 4 === 0;
    context.strokeStyle = major ? 'rgba(84, 136, 200, 0.55)' : 'rgba(110, 160, 215, 0.35)';
    context.lineWidth = major ? 0.045 : 0.025;
    context.beginPath();
    context.moveTo(-SHEET_WIDTH / 2, y);
    context.lineTo(SHEET_WIDTH / 2, y);
    context.stroke();
  }
  if (options.spiral) {
    // The pull, as a child would show it: a pencil spiral winding in to the sun.
    const turns = 3.2;
    const points: Point[] = [];
    for (let step = 0; step <= 260; step++) {
      const t = step / 260;
      const angle = t * turns * Math.PI * 2;
      const radius = 7.5 - t * 5.6;
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    crayonLine(pad, points, 'rgba(105, 105, 115, 0.5)', 0.05, rng, { passes: 2, wobble: 0.035 });
  }
  const corners: Point[] = [
    [-HALF_WIDTH, -HALF_DEPTH],
    [HALF_WIDTH, -HALF_DEPTH],
    [HALF_WIDTH, HALF_DEPTH],
    [-HALF_WIDTH, HALF_DEPTH],
  ];
  if (options.solidEdges) {
    crayonLine(pad, corners, '#4b4f60', 0.16, rng, { closed: true, passes: 3, wobble: 0.06 });
  } else {
    for (let side = 0; side < 4; side++) {
      const [ax, ay] = corners[side] ?? [0, 0];
      const [bx, by] = corners[(side + 1) % 4] ?? [0, 0];
      const length = Math.hypot(bx - ax, by - ay);
      for (let along = 0; along < length; along += 1.2) {
        const a = along / length;
        const b = Math.min(1, (along + 0.6) / length);
        crayonLine(
          pad,
          [
            [ax + (bx - ax) * a, ay + (by - ay) * a],
            [ax + (bx - ax) * b, ay + (by - ay) * b],
          ],
          '#7d8296',
          0.08,
          rng,
          { passes: 2 },
        );
      }
    }
  }
  return pad;
}

/** The sun: a yellow crayon ball with an orange edge, a smile, rosy cheeks and wobbly rays. */
export function drawSun(rng: Rng, radius: number): Pad {
  const size = radius * 4.2;
  const pad = createPad(size, size, 90);
  for (let ray = 0; ray < 12; ray++) {
    const angle = (ray / 12) * Math.PI * 2 + rng.float(-0.06, 0.06);
    const inner = radius * 1.25;
    const outer = radius * (ray % 2 === 0 ? 1.95 : 1.65);
    const mid = (inner + outer) / 2;
    const bend = rng.float(-0.12, 0.12);
    crayonLine(
      pad,
      [
        [Math.cos(angle) * inner, Math.sin(angle) * inner],
        [Math.cos(angle + bend) * mid, Math.sin(angle + bend) * mid],
        [Math.cos(angle) * outer, Math.sin(angle) * outer],
      ],
      '#f2a12a',
      0.14,
      rng,
    );
  }
  const disc = circle(0, 0, radius);
  crayonFill(pad, disc, '#ffd33d', rng, 0.05);
  crayonFill(pad, circle(-radius * 0.25, -radius * 0.3, radius * 0.45), '#fff07a', rng, 0.05);
  crayonLine(pad, disc, '#f08a1c', 0.12, rng, { closed: true });
  for (const side of [-1, 1]) {
    crayonFill(
      pad,
      circle(side * radius * 0.36, -radius * 0.18, radius * 0.1, 12),
      '#3a2a20',
      rng,
      0.03,
    );
    crayonFill(
      pad,
      circle(side * radius * 0.55, radius * 0.18, radius * 0.16, 14),
      'rgba(255,120,110,0.75)',
      rng,
      0.04,
    );
  }
  const smile: Point[] = Array.from({ length: 12 }, (_, index) => {
    const angle = Math.PI * (0.18 + (index / 11) * 0.64);
    return [
      Math.cos(angle) * radius * 0.48,
      Math.sin(angle) * radius * 0.42 + radius * 0.02,
    ] as const;
  });
  crayonLine(pad, smile, '#3a2a20', 0.08, rng, { passes: 2 });
  return pad;
}

interface RocketDesign {
  readonly body: readonly Point[];
  readonly nose: readonly Point[];
  readonly fins: readonly (readonly Point[])[];
  readonly window: { readonly x: number; readonly radius: number };
  readonly stripes: readonly number[];
  /** Where the flame starts, at the tail. */
  readonly tail: number;
}

/** Zip, seat 1: a long thin rocket with a pointy nose and two swept fins. */
const ZIP: RocketDesign = {
  body: [
    [0.55, -0.28],
    [-0.95, -0.28],
    [-1.05, -0.2],
    [-1.05, 0.2],
    [-0.95, 0.28],
    [0.55, 0.28],
  ],
  nose: [
    [0.55, -0.28],
    [1.2, 0],
    [0.55, 0.28],
  ],
  fins: [
    [
      [-0.45, -0.28],
      [-1.05, -0.72],
      [-1.15, -0.28],
    ],
    [
      [-0.45, 0.28],
      [-1.05, 0.72],
      [-1.15, 0.28],
    ],
  ],
  window: { x: 0.1, radius: 0.18 },
  stripes: [],
  tail: -1.1,
};

/** Bubble, seat 2: a fat round rocket with a big window, two stripes and three stubby fins. */
const BUBBLE: RocketDesign = {
  body: circle(0, 0, 0.62, 30).map(([x, y]) => [x * 1.45, y] as const),
  nose: [
    [0.82, -0.3],
    [1.12, 0],
    [0.82, 0.3],
  ],
  fins: [
    [
      [-0.55, -0.45],
      [-1.05, -0.78],
      [-0.95, -0.3],
    ],
    [
      [-0.55, 0.45],
      [-1.05, 0.78],
      [-0.95, 0.3],
    ],
    [
      [-0.75, -0.1],
      [-1.15, 0],
      [-0.75, 0.1],
    ],
  ],
  window: { x: 0.2, radius: 0.3 },
  stripes: [-0.35, -0.55],
  tail: -0.95,
};

export const ROCKETS: readonly [RocketDesign, RocketDesign] = [ZIP, BUBBLE];

/** A rocket drawn on its side, nose to +x, in the seat's crayon; `glow` draws only its glow-in-the-dark lines. */
export function drawRocket(rng: Rng, seat: Seat, colours: SeatColours, glow: boolean): Pad {
  const design = ROCKETS[seat];
  const pad = createPad(2.8, 1.8, 120);
  const ink = glow ? '#9dffc8' : '#2e2a33';
  if (!glow) {
    for (const fin of design.fins) crayonFill(pad, fin, colours.deep, rng, 0.04);
    crayonFill(pad, design.body, colours.main, rng, 0.04);
    crayonFill(pad, design.nose, '#e8423b', rng, 0.035);
    for (const x of design.stripes) {
      crayonLine(
        pad,
        [
          [x, -0.55],
          [x, 0.55],
        ],
        '#ffffff',
        0.09,
        rng,
        { passes: 2 },
      );
    }
    crayonFill(pad, circle(design.window.x, 0, design.window.radius, 18), '#bfe6ff', rng, 0.03);
  }
  for (const fin of design.fins) crayonLine(pad, fin, ink, 0.06, rng, { closed: true, passes: 2 });
  crayonLine(pad, design.body, ink, 0.07, rng, { closed: true, passes: 2 });
  crayonLine(pad, design.nose, ink, 0.06, rng, { closed: true, passes: 2 });
  crayonLine(pad, circle(design.window.x, 0, design.window.radius, 18), ink, 0.05, rng, {
    closed: true,
    passes: 2,
  });
  return pad;
}

/** A scribbled flame, yellow inside orange inside red, drawn pointing back along -x. */
export function drawFlame(rng: Rng): Pad {
  const pad = createPad(1.8, 1, 110);
  const tongue = (length: number, width: number): Point[] => {
    const points: Point[] = [[0, -width]];
    for (let step = 1; step <= 6; step++) {
      const t = step / 6;
      points.push([-length * t, (step % 2 === 0 ? -1 : 1) * width * (1 - t) * rng.float(0.6, 1.1)]);
    }
    points.push([0, width]);
    return points;
  };
  crayonFill(pad, tongue(0.85, 0.32), '#e8423b', rng, 0.035);
  crayonFill(pad, tongue(0.6, 0.22), '#ff9a1f', rng, 0.03);
  crayonFill(pad, tongue(0.35, 0.12), '#ffe14d', rng, 0.03);
  return pad;
}

/** The missile: a short pencil dash with a coloured tip. */
export function drawDash(rng: Rng, colours: SeatColours): Pad {
  const pad = createPad(0.8, 0.3, 140);
  crayonLine(
    pad,
    [
      [-0.32, 0],
      [0.18, 0],
    ],
    '#3b3b42',
    0.1,
    rng,
    { passes: 3, wobble: 0.01 },
  );
  crayonLine(
    pad,
    [
      [0.16, 0],
      [0.32, 0],
    ],
    colours.main,
    0.13,
    rng,
    { passes: 3, wobble: 0.01 },
  );
  return pad;
}

/** A hit: a zigzag starburst, yellow with a red edge, like a comic's BANG without the word. */
export function drawStarburst(rng: Rng): Pad {
  const pad = createPad(2.4, 2.4, 100);
  const points: Point[] = [];
  for (let spike = 0; spike < 24; spike++) {
    const angle = (spike / 24) * Math.PI * 2;
    const radius = spike % 2 === 0 ? rng.float(0.95, 1.15) : rng.float(0.45, 0.6);
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  crayonFill(pad, points, '#ffd93d', rng, 0.04);
  crayonFill(
    pad,
    points.map(([x, y]) => [x * 0.55, y * 0.55] as const),
    '#ff8c1f',
    rng,
    0.04,
  );
  crayonLine(pad, points, '#e0382f', 0.09, rng, { closed: true, passes: 3 });
  return pad;
}

/** A little five-pointed doodle star, for the sparks of a hit. */
export function drawDoodleStar(rng: Rng, colour: string): Pad {
  const pad = createPad(0.6, 0.6, 100);
  const points: Point[] = [];
  for (let tip = 0; tip < 10; tip++) {
    const angle = (tip / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = tip % 2 === 0 ? 0.27 : 0.11;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  crayonFill(pad, points, colour, rng, 0.03);
  crayonLine(pad, points, '#2e2a33', 0.035, rng, { closed: true, passes: 2 });
  return pad;
}

/** The starbase: a full moon in pale crayon with craters, and a little door to knock on. */
export function drawMoon(rng: Rng, radius: number): Pad {
  const size = radius * 2.8;
  const pad = createPad(size, size, 90);
  const disc = circle(0, 0, radius);
  crayonFill(pad, disc, '#f1ead2', rng, 0.05);
  crayonFill(pad, circle(radius * 0.25, radius * 0.25, radius * 0.6), '#e2d8b4', rng, 0.05);
  for (const [x, y, size] of [
    [-0.45, -0.35, 0.18],
    [0.4, -0.5, 0.12],
    [0.5, 0.35, 0.15],
    [-0.15, 0.55, 0.1],
  ] as const) {
    crayonLine(pad, circle(x * radius, y * radius, size * radius, 14), '#b9ab84', 0.06, rng, {
      closed: true,
      passes: 2,
    });
  }
  crayonLine(pad, disc, '#8f8466', 0.11, rng, { closed: true });
  // The door: an arched little rectangle in red crayon with a yellow knob.
  const door: Point[] = [
    [-0.18 * radius, 0.42 * radius],
    [-0.18 * radius, 0.02 * radius],
    [-0.1 * radius, -0.1 * radius],
    [0.1 * radius, -0.1 * radius],
    [0.18 * radius, 0.02 * radius],
    [0.18 * radius, 0.42 * radius],
  ];
  crayonFill(pad, door, '#d9473b', rng, 0.04);
  crayonLine(pad, door, '#7a2620', 0.06, rng, { closed: true, passes: 2 });
  crayonFill(pad, circle(0.1 * radius, 0.2 * radius, 0.035 * radius, 8), '#ffd33d', rng, 0.02);
  return pad;
}

/** The beacon: a red horseshoe magnet with silver tips, and wiggly lines where it pulls. */
export function drawMagnet(rng: Rng, radius: number): Pad {
  const size = radius * 3.6;
  const pad = createPad(size, size, 90);
  for (let ring = 1; ring <= 3; ring++) {
    const reach = radius * (0.9 + ring * 0.38);
    const wiggle: Point[] = Array.from({ length: 40 }, (_, index) => {
      const angle = (index / 40) * Math.PI * 2;
      const wobble = Math.sin(angle * 9 + ring) * radius * 0.05;
      return [Math.cos(angle) * (reach + wobble), Math.sin(angle) * (reach + wobble)] as const;
    });
    crayonLine(pad, wiggle, '#8e7cc3', 0.05, rng, { closed: true, passes: 2 });
  }
  const outer = radius * 0.75;
  const inner = radius * 0.38;
  const arch: Point[] = [];
  for (let step = 0; step <= 14; step++) {
    const angle = Math.PI + (step / 14) * Math.PI;
    arch.push([Math.cos(angle) * outer, Math.sin(angle) * outer]);
  }
  arch.push([outer, radius * 0.5], [inner, radius * 0.5]);
  for (let step = 14; step >= 0; step--) {
    const angle = Math.PI + (step / 14) * Math.PI;
    arch.push([Math.cos(angle) * inner, Math.sin(angle) * inner]);
  }
  arch.push([-inner, radius * 0.5], [-outer, radius * 0.5]);
  crayonFill(pad, arch, '#e0382f', rng, 0.04);
  crayonLine(pad, arch, '#7a1d18', 0.07, rng, { closed: true, passes: 2 });
  for (const side of [-1, 1]) {
    const tip: Point[] = [
      [side * outer, radius * 0.5],
      [side * inner, radius * 0.5],
      [side * inner, radius * 0.78],
      [side * outer, radius * 0.78],
    ];
    crayonFill(pad, tip, '#c9ced6', rng, 0.03);
    crayonLine(pad, tip, '#5c6370', 0.05, rng, { closed: true, passes: 2 });
  }
  return pad;
}

/** A pod: a folded paper plane seen from above, its fold line in the colour of the seat it is for. */
export function drawPlane(rng: Rng, colour: string): Pad {
  const pad = createPad(1.4, 1.0, 100);
  const wings: Point[] = [
    [0.6, 0],
    [-0.5, 0.42],
    [-0.36, 0.05],
    [-0.55, 0],
    [-0.36, -0.05],
    [-0.5, -0.42],
  ];
  crayonFill(pad, wings, '#ffffff', rng, 0.04);
  crayonLine(pad, wings, '#3a3a44', 0.04, rng, { closed: true, passes: 2, wobble: 0.01 });
  crayonLine(
    pad,
    [
      [0.6, 0],
      [-0.55, 0],
    ],
    colour,
    0.06,
    rng,
    { passes: 3, wobble: 0.01 },
  );
  crayonLine(
    pad,
    [
      [0.3, 0.06],
      [-0.4, 0.28],
    ],
    colour,
    0.035,
    rng,
    { passes: 2, wobble: 0.01 },
  );
  return pad;
}

/** The comet: a five-pointed head and three wavy crayon streaks behind it, along +x. */
export function drawComet(rng: Rng): Pad {
  const pad = createPad(3.2, 1.4, 90);
  for (const [offset, colour] of [
    [-0.32, '#ff9c3a'],
    [0, '#ffd33d'],
    [0.32, '#ff6f61'],
  ] as const) {
    const streak: Point[] = Array.from({ length: 12 }, (_, index) => {
      const x = 0.9 - index * 0.2;
      return [x, offset * (1 - (0.9 - x) * 0.25) + Math.sin(index * 1.3) * 0.05] as const;
    });
    crayonLine(pad, streak, colour, 0.1, rng, { passes: 2 });
  }
  const head: Point[] = [];
  for (let tip = 0; tip < 10; tip++) {
    const angle = (tip / 10) * Math.PI * 2;
    const radius = tip % 2 === 0 ? 0.42 : 0.18;
    head.push([1.05 + Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  crayonFill(pad, head, '#fff07a', rng, 0.03);
  crayonLine(pad, head, '#e08a1c', 0.06, rng, { closed: true, passes: 2 });
  return pad;
}

/** A rock for the asteroid belt: a lumpy grey crayon blob with a crack or two. */
export function drawRock(rng: Rng): Pad {
  const pad = createPad(1.2, 1.2, 100);
  const outline: Point[] = Array.from({ length: 11 }, (_, index) => {
    const angle = (index / 11) * Math.PI * 2;
    const radius = rng.float(0.38, 0.5);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  });
  crayonFill(pad, outline, '#9a948a', rng, 0.04);
  crayonFill(pad, circle(-0.1, -0.12, 0.18, 10), '#b8b2a6', rng, 0.04);
  crayonLine(pad, outline, '#4e4a44', 0.06, rng, { closed: true, passes: 2 });
  crayonLine(
    pad,
    [
      [0.05, -0.1],
      [0.14, 0.04],
      [0.08, 0.18],
    ],
    '#4e4a44',
    0.03,
    rng,
    { passes: 1 },
  );
  return pad;
}
