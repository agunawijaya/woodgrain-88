/**
 * The Neighbourhood Kids' school photos: a 1988 head-and-shoulders portrait
 * against a mottled studio backdrop, drawn from each kid's portrait data in
 * the kit. One renderer draws all six, so they look like the same
 * photographer took them on the same picture day; hair, clothes, extras and
 * the backdrop make each kid unmistakable. Expressions: the posed photo
 * smile, a big grin for a win, and a sulk for a loss.
 *
 * Drawn on a 120×150 grid. No real person is depicted.
 */
import { createRng, mix, type Kid, type KidPortrait } from '@woodgrain-88/kit';

export type KidExpression = 'photo' | 'win' | 'lose';

const W = 120;
const H = 150;
const n = (value: number) => Math.round(value * 100) / 100;

function backdrop(id: string, portrait: KidPortrait, seed: string): string {
  // The classic studio cloth: soft mottled blotches and a lit centre.
  const rng = createRng(`backdrop/${seed}`);
  let blotches = '';
  for (let i = 0; i < 14; i++) {
    const tone = rng.chance(0.5) ? mix(portrait.backdrop, '#ffffff', rng.float(0.1, 0.3)) : mix(portrait.backdrop, '#000000', rng.float(0.1, 0.25));
    blotches += `<ellipse cx="${n(rng.float(0, W))}" cy="${n(rng.float(0, H))}" rx="${n(rng.float(14, 34))}" ry="${n(rng.float(10, 26))}" fill="${tone}" opacity="0.35"/>`;
  }
  return (
    `<rect width="${W}" height="${H}" fill="${portrait.backdrop}"/>` +
    `<g filter="url(#${id}-soft)">${blotches}</g>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-spot)"/>`
  );
}

function shoulders(portrait: KidPortrait): string {
  const { top } = portrait;
  const shadow = mix(top.colour, '#000000', 0.28);
  const light = mix(top.colour, '#ffffff', 0.16);
  const body = 'M10 150C12 124 30 112 46 108L60 114L74 108C90 112 108 124 110 150Z';
  let detail = '';
  switch (top.style) {
    case 'sweater':
      // A crew-neck with a band of zig-zag knit across the chest.
      detail =
        `<path d="M46 108Q60 120 74 108" fill="none" stroke="${shadow}" stroke-width="4"/>` +
        `<path d="M18 134l6-5 6 5 6-5 6 5 6-5 6 5 6-5 6 5 6-5 6 5 6-5 6 5 6-5 6 5" fill="none" stroke="${top.accent}" stroke-width="3" stroke-linejoin="round"/>`;
      break;
    case 'polo':
      detail =
        `<path d="M50 108L60 124L70 108L66 106L60 116L54 106Z" fill="${light}"/>` +
        `<path d="M60 116V132" stroke="${shadow}" stroke-width="1.2"/><circle cx="60" cy="122" r="1.3" fill="${top.accent}"/><circle cx="60" cy="128" r="1.3" fill="${top.accent}"/>`;
      break;
    case 'cardigan':
      detail =
        `<path d="M48 108L60 140L72 108" fill="${top.accent}"/>` +
        `<path d="M60 140V150" stroke="${shadow}" stroke-width="2"/>` +
        `<circle cx="64" cy="130" r="1.6" fill="${shadow}"/><circle cx="66" cy="141" r="1.6" fill="${shadow}"/>` +
        `<path d="M48 108L56 132M72 108L64 132" stroke="${shadow}" stroke-width="2" fill="none"/>`;
      break;
    case 'tee':
      detail =
        `<path d="M47 108Q60 118 73 108" fill="none" stroke="${top.accent}" stroke-width="3"/>` +
        `<path d="M50 130l10-8 10 8-10 8Z" fill="${top.accent}"/>`;
      break;
    case 'denim':
      // A denim jacket over a tee: collar points, seams and a stitched pocket.
      detail =
        `<path d="M50 108Q60 116 70 108" fill="${top.accent}"/>` +
        `<path d="M42 108L52 124L58 112ZM78 108L68 124L62 112Z" fill="${light}" stroke="${shadow}" stroke-width="1"/>` +
        `<path d="M34 132h16v10H34ZM70 132h16v10H70Z" fill="none" stroke="#f2c14e" stroke-width="0.9" stroke-dasharray="1.6 1.2"/>`;
      break;
    case 'turtleneck':
      detail =
        `<path d="M46 106h28v9q-14 5-28 0Z" fill="${light}"/>` +
        `<path d="M47 109h26M47 112h26" stroke="${shadow}" stroke-width="0.8"/>`;
      break;
  }
  return (
    `<path d="${body}" fill="${top.colour}"/>` +
    `<path d="M10 150C12 124 30 112 46 108L50 110C36 116 24 128 22 150Z" fill="${shadow}" opacity="0.55"/>` +
    detail
  );
}

function hairBack(portrait: KidPortrait): string {
  const { colour, style } = portrait.hair;
  switch (style) {
    case 'bob':
      return `<path d="M30 60C28 30 92 30 90 60C92 80 90 96 84 100L36 100C30 96 28 80 30 60Z" fill="${colour}"/>`;
    case 'ponytail':
      return `<path d="M84 46C102 52 104 82 92 98C96 80 92 62 82 56Z" fill="${colour}"/>`;
    case 'curls':
      return circlesRing(60, 58, 31, 15, 9.5, colour, 'curls-back');
    default:
      return '';
  }
}

function circlesRing(cx: number, cy: number, radius: number, count: number, size: number, colour: string, seed: string): string {
  const rng = createRng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const angle = Math.PI * (1.05 + (i / (count - 1)) * 0.9) - Math.PI * 0.05;
    const r = size * rng.float(0.85, 1.15);
    d += `<circle cx="${n(cx + radius * Math.cos(angle))}" cy="${n(cy + radius * 0.9 * Math.sin(angle))}" r="${n(r)}" fill="${colour}"/>`;
  }
  return d;
}

function hairFront(portrait: KidPortrait): string {
  const { colour, style } = portrait.hair;
  const shine = mix(colour, '#ffffff', 0.25);
  switch (style) {
    case 'curls':
      // A solid mop first, sitting on the scalp down to the hairline, then the curls round its edge.
      return (
        `<path d="M33 62C30 38 46 30 60 30C74 30 90 38 87 62C84 54 78 50 72 50C68 47 64 49 60 48C56 49 52 47 48 50C42 50 36 54 33 62Z" fill="${colour}"/>` +
        circlesRing(60, 52, 25, 11, 8, colour, 'curls-front') +
        `<circle cx="49" cy="38" r="3" fill="${shine}" opacity="0.5"/>`
      );
    case 'bob':
      return `<path d="M32 58C30 32 90 32 88 58C80 48 70 46 60 48C50 46 40 48 32 58Z" fill="${colour}"/><path d="M42 45Q60 39 76 45" stroke="${shine}" stroke-width="2" fill="none" opacity="0.5"/>`;
    case 'spikes':
      return `<path d="M34.6 66C33.4 60 33 53 33 48L30 40L38 44L38 28L46 38L50 22L56 36L62 20L66 36L74 24L76 38L84 30L82 44L90 42L87 48C87 53 86.6 60 85.4 66C84 58 81 52 76 50C71 47.6 66 46.6 60 46.6C54 46.6 49 47.6 44 50C39 52 36 58 34.6 66Z" fill="${colour}"/>`;
    case 'bald-ring':
      // Grandpa Lou: a shiny crown with a fringe of grey round the sides.
      return (
        [false, true]
          .map((mirror) => {
            // Lying flat against the side of the head, its outer edge on the head's own outline.
            const fringe = 'M38.6 49.4C36 53 34.6 58.6 34.8 64.6C35 67.8 35.8 70.4 37.2 72.2C37.8 68.4 39.6 65.4 41.6 63.4C40.4 60.2 40 55.8 41.2 51.8C40.4 50.8 39.6 50 38.6 49.4Z';
            const wisps = 'M37.2 56.4l2.2 1.2M36.8 61l2.4 0.8M37 65.6l2.2 0.2';
            // Each side sits a touch out from the middle, so the two fringes frame the head.
            const turn = mirror ? ' transform="translate(120.8 0) scale(-1 1)"' : ' transform="translate(-0.8 0)"';
            return `<g${turn}><path d="${fringe}" fill="${colour}"/><path d="${wisps}" stroke="${mix(colour, '#000000', 0.16)}" stroke-width="0.8" stroke-linecap="round"/></g>`;
          })
          .join('') +
        `<ellipse cx="51" cy="46" rx="9" ry="3.6" fill="#ffffff" opacity="0.26" transform="rotate(-12 51 46)"/>`
      );
    case 'ponytail':
      return `<path d="M32 58C30 30 90 30 88 56C78 44 66 40 54 42C44 44 36 50 32 58Z" fill="${colour}"/><path d="M84 50c4 2 6 6 5 10" stroke="${mix(colour, '#000000', 0.3)}" stroke-width="3" fill="none"/>`;
    case 'bowl':
      return `<path d="M30 62C28 30 92 30 90 62C88 56 88 54 86 54H34C32 54 32 56 30 62Z" fill="${colour}"/><path d="M36 54h48" stroke="${mix(colour, '#000000', 0.25)}" stroke-width="1.2"/><path d="M42 45Q60 39 78 45" stroke="${shine}" stroke-width="2.2" fill="none" opacity="0.45"/>`;
  }
}

interface MouthInk {
  lip: string;
  shade: string;
  hair: string;
  /** Unique per portrait, for the clip that keeps the tongue inside the mouth. */
  id: string;
}

const MOUTH_DARK = '#5a1f1c';
const TEETH = '#fbf7ee';
const TONGUE = '#d9686a';

const line = (d: string, colour: string, width = 2.4) =>
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shape = (d: string, colour: string) => `<path d="${d}" fill="${colour}"/>`;

/** An open mouth with a tongue resting on its floor, clipped to the mouth so it can never hang below the lip. */
function openMouth(id: string, mouth: string, teeth: string, tongue: string): string {
  return (
    `<clipPath id="${id}-mouth"><path d="${mouth}"/></clipPath>` +
    shape(mouth, MOUTH_DARK) +
    `<g clip-path="url(#${id}-mouth)">${shape(tongue, TONGUE)}${shape(teeth, TEETH)}</g>`
  );
}

/**
 * Every kid smiles their own way for the photo, and wins and loses their own
 * way too: Dee's gap-toothed grin, Moss's small closed smile with a dimple,
 * Pip's open laugh, Grandpa Lou's smile under his moustache, Rosa's braces,
 * Benny's two big front teeth.
 */
const MOUTHS: Record<KidPortrait['smile'], Record<KidExpression, (ink: MouthInk) => string>> = {
  'gap-grin': {
    photo: () =>
      shape('M46 82Q60 96 74 82Q60 85 46 82Z', MOUTH_DARK) +
      shape('M48 83Q60 86.2 72 83L70.6 86.2Q60 88.6 49.4 86.2Z', TEETH) +
      shape('M59.2 84.6h1.6v3.6h-1.6Z', MOUTH_DARK),
    win: ({ id }) =>
      openMouth(id, 'M44 80Q60 100 76 80Q60 84 44 80Z', 'M46.5 81.2Q60 85.4 73.5 81.2L72 85.2Q60 88.2 48 85.2Z', 'M50 92Q60 84 70 92V96H50Z') +
      shape('M59.2 83.8h1.6v4h-1.6Z', MOUTH_DARK),
    lose: ({ lip }) =>
      shape('M50 85.5h20v4.5h-20Z', TEETH) +
      line('M54 85.5v4.5M58 85.5v4.5M62 85.5v4.5M66 85.5v4.5', '#c9bfae', 0.6) +
      line('M49 87Q49 85 51 85.2H69Q71 85 71 87Q71 90.5 69 90.4H51Q49 90.5 49 87Z', lip, 1.8),
  },
  closed: {
    photo: ({ lip, shade }) => line('M52.5 86.2Q59 89.6 67.8 84.6', lip) + line('M69.2 83.4q1.5 1.3 .6 2.8', shade, 1.2),
    win: ({ lip, shade }) => line('M50.5 85Q60 92.4 70 84', lip, 2.6) + line('M71.4 82.8q1.6 1.4 .6 3', shade, 1.2),
    lose: ({ lip }) => line('M53 88.4Q57 87.4 60 88Q63 88.6 67 87.6', lip, 2.2),
  },
  laugh: {
    photo: ({ id }) =>
      openMouth(id, 'M47 81.5Q60 100 73 81.5Q66 84 60 84Q54 84 47 81.5Z', 'M49 82.4Q60 86 71 82.4L69.8 85.4Q60 88 50.2 85.4Z', 'M51 91Q60 85.4 69 91V96H51Z'),
    win: ({ id }) =>
      openMouth(id, 'M45 80Q60 104 75 80Q66 83.4 60 83.4Q54 83.4 45 80Z', 'M47.4 81Q60 85 72.6 81L71.2 84.6Q60 87.6 48.8 84.6Z', 'M50 92Q60 85.6 70 92V98H50Z'),
    lose: ({ lip }) => line('M49.5 89.5q2.6-3 5.2 0t5.2 0t5.2 0t5.2 0', lip, 2.2),
  },
  moustache: {
    photo: ({ lip, hair }) =>
      line('M53.5 87.4Q60 90.6 66.5 87.4', lip, 2.2) +
      shape('M45 83.5Q49 77.8 55 79Q58 79.4 60 80.8Q62 79.4 65 79Q71 77.8 75 83.5Q70 82.2 66 83.4Q63 84.2 60 82.8Q57 84.2 54 83.4Q50 82.2 45 83.5Z', hair) +
      line('M50 81.6q4-1.6 8 .2M62 81.8q4-1.8 8-.2', mix(hair, '#000000', 0.25), 0.7),
    win: ({ hair }) =>
      shape('M52 86Q60 93 68 86Q60 87.8 52 86Z', MOUTH_DARK) +
      shape('M53.6 86.4Q60 88.2 66.4 86.4L65.6 87.8Q60 89.2 54.4 87.8Z', TEETH) +
      shape('M44 82.8Q48.6 76.6 55 78.2Q58 78.6 60 80Q62 78.6 65 78.2Q71.4 76.6 76 82.8Q70.4 81.4 66 82.8Q63 83.6 60 82.2Q57 83.6 54 82.8Q49.6 81.4 44 82.8Z', hair),
    lose: ({ lip, hair }) =>
      line('M54 89.2Q60 87.6 66 89.2', lip, 2) +
      // The moustache droops at the ends.
      shape('M46 87Q47.4 79.6 54.6 79.6Q58 79.6 60 81.2Q62 79.6 65.4 79.6Q72.6 79.6 74 87Q71 83.8 66.4 84Q63 84.4 60 83.2Q57 84.4 53.6 84Q49 83.8 46 87Z', hair),
  },
  braces: {
    photo: ({ lip }) => line('M50 84Q60 92 70 84', lip) + line('M53 86Q60 89 67 86', '#ffffff', 1.2),
    win: () => shape('M48 84Q60 98 72 84Z', MOUTH_DARK) + line('M50 85Q60 89 70 85', '#ffffff'),
    lose: ({ lip }) => line('M51 89Q60 83 69 89', lip),
  },
  buck: {
    photo: ({ lip }) =>
      shape('M57.2 86.6h2.6v3.6q-1.3 .8-2.6 0ZM60.2 86.6h2.6v3.6q-1.3 .8-2.6 0Z', TEETH) +
      line('M57.2 86.6h5.6', '#d8cfc0', 0.5) +
      line('M49.5 84Q60 89.6 70.5 84', lip),
    win: () =>
      shape('M47.5 83Q60 98 72.5 83Q60 86.4 47.5 83Z', MOUTH_DARK) +
      shape('M56.8 84.6h3v4.6q-1.5 1-3 0ZM60.2 84.6h3v4.6q-1.5 1-3 0Z', TEETH),
    lose: ({ lip }) =>
      shape('M57.6 86.4h2.3v2.8q-1.15 .6-2.3 0ZM60.1 86.4h2.3v2.8q-1.15 .6-2.3 0Z', TEETH) + line('M51.5 88.6Q60 84.4 68.5 88.6', lip, 2.2),
  },
};

function face(portrait: KidPortrait, expression: KidExpression, id: string): string {
  const skin = portrait.skin;
  const shade = mix(skin, '#3a1d10', 0.28);
  const cheek = mix(skin, '#e06a5a', 0.32);
  const lip = mix(skin, '#a3423a', 0.55);
  const ink = '#2a1a14';
  const browLift = expression === 'win' ? -2 : expression === 'lose' ? 1.5 : 0;
  const browTilt = expression === 'lose' ? 2.2 : 0;
  const mouth = MOUTHS[portrait.smile][expression]({ lip, shade, hair: portrait.hair.colour, id });
  return (
    // Neck, ears, head and the shadow under the jaw.
    `<path d="M51 92h18v18q-9 5-18 0Z" fill="${shade}"/>` +
    `<ellipse cx="33" cy="68" rx="5" ry="8" fill="${skin}"/><ellipse cx="87" cy="68" rx="5" ry="8" fill="${skin}"/>` +
    `<path d="M34 60C34 34 86 34 86 60C86 82 74 98 60 98C46 98 34 82 34 60Z" fill="${skin}"/>` +
    `<path d="M34 60C34 82 46 98 60 98C50 94 40 82 38 64Z" fill="${shade}" opacity="0.35"/>` +
    `<ellipse cx="45" cy="78" rx="5.5" ry="3.5" fill="${cheek}" opacity="0.45"/><ellipse cx="75" cy="78" rx="5.5" ry="3.5" fill="${cheek}" opacity="0.45"/>` +
    // Eyes and brows: the brows carry most of the expression.
    `<ellipse cx="48" cy="66" rx="4.2" ry="${expression === 'win' ? 2.6 : 3.4}" fill="#ffffff"/><ellipse cx="72" cy="66" rx="4.2" ry="${expression === 'win' ? 2.6 : 3.4}" fill="#ffffff"/>` +
    `<circle cx="48.5" cy="66.5" r="2.3" fill="${ink}"/><circle cx="72.5" cy="66.5" r="2.3" fill="${ink}"/>` +
    `<circle cx="49.3" cy="65.6" r="0.8" fill="#ffffff"/><circle cx="73.3" cy="65.6" r="0.8" fill="#ffffff"/>` +
    `<path d="M42 ${n(59 + browLift - browTilt)}Q48 ${n(56 + browLift)} 54 ${n(59 + browLift + browTilt)}" fill="none" stroke="${mix(portrait.hair.colour, ink, 0.4)}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M66 ${n(59 + browLift + browTilt)}Q72 ${n(56 + browLift)} 78 ${n(59 + browLift - browTilt)}" fill="none" stroke="${mix(portrait.hair.colour, ink, 0.4)}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M60 68Q57 76 60 78Q63 79 64 77" fill="none" stroke="${shade}" stroke-width="1.6" stroke-linecap="round"/>` +
    mouth
  );
}

function extras(portrait: KidPortrait, expression: KidExpression): string {
  switch (portrait.extra) {
    case 'glasses':
      return (
        `<rect x="40" y="60" width="16" height="13" rx="4" fill="#ffffff" fill-opacity="0.12" stroke="#5a3b24" stroke-width="2"/>` +
        `<rect x="64" y="60" width="16" height="13" rx="4" fill="#ffffff" fill-opacity="0.12" stroke="#5a3b24" stroke-width="2"/>` +
        `<path d="M56 65h8M40 64l-6-2M80 64l6-2" stroke="#5a3b24" stroke-width="2"/>` +
        `<path d="M43 62l4 4M67 62l4 4" stroke="#ffffff" stroke-width="1.2" opacity="0.6"/>`
      );
    case 'freckles': {
      const rng = createRng('freckles');
      let dots = '';
      for (let i = 0; i < 14; i++) {
        const side = i % 2 === 0 ? 46 : 74;
        dots += `<circle cx="${n(side + rng.float(-6, 6))}" cy="${n(74 + rng.float(-3, 4))}" r="0.8" fill="#9a4a2a" opacity="0.7"/>`;
      }
      return dots;
    }
    case 'braces':
      return expression === 'lose' ? '' : `<path d="M51 86h18" stroke="#c9d1d9" stroke-width="1.4" stroke-dasharray="2 1.4"/>`;
    case 'headband':
      return `<path d="M33 48Q60 36 87 48" fill="none" stroke="#f2a22c" stroke-width="5" stroke-linecap="round"/><path d="M33 48Q60 36 87 48" fill="none" stroke="#e8463a" stroke-width="1.6" stroke-linecap="round"/>`;
    case 'bow-tie':
      return `<path d="M52 108l8 4-8 4ZM68 108l-8 4 8 4Z" fill="#b8433a"/><circle cx="60" cy="112" r="2.2" fill="#8a2d26"/>`;
    case 'none':
      return '';
  }
}

/** One kid's school photo as a standalone SVG. `idPrefix` keeps ids unique when several share a page. */
export function kidPortraitSvg(kid: Kid, options: { expression?: KidExpression; idPrefix?: string; title?: boolean } = {}): string {
  const expression = options.expression ?? 'photo';
  const id = options.idPrefix ?? `kid-${kid.id}`;
  const { portrait } = kid;
  const label = options.title ? `role="img" aria-label="${kid.name}"` : 'aria-hidden="true"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="kid-portrait" ${label}>` +
    `<defs>` +
    `<filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>` +
    `<radialGradient id="${id}-spot" cx="0.5" cy="0.42" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.3"/><stop offset="1" stop-color="#000000" stop-opacity="0.3"/></radialGradient>` +
    `</defs>` +
    backdrop(id, portrait, kid.id) +
    hairBack(portrait) +
    shoulders(portrait) +
    face(portrait, expression, id) +
    hairFront(portrait) +
    extras(portrait, expression) +
    `</svg>`
  );
}
