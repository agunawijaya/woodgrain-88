/**
 * How the Den's earned items look: the four family posters (each in its own
 * 1980s poster style), trophies for the Label Wall's short rows, a paper
 * chain across the window, string lights along the shelves, the ON AIR sign
 * and the remote on the TV, the 32 in 1 plaque on the Counter.
 *
 * Lights and neon have two parts: the bulbs and tubes, drawn with the room,
 * and their glow, drawn in the night layer so it only shows after dark.
 */
import { createRng, FAMILIES, type Family, type GameManifest } from '@woodgrain-88/kit';
import { LAYOUT, WALL, wallSlot, type Rect } from './geometry.ts';
import { chalkDefs } from './chalkboard.ts';
import { escapeXml, n } from './svg.ts';

export function growthDefs(): string {
  return (
    chalkDefs() +
    `
    <linearGradient id="den-trophy-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff1b0"/><stop offset="0.35" stop-color="#e2b84a"/>
      <stop offset="0.7" stop-color="#a8761c"/><stop offset="1" stop-color="#f0cf6a"/>
    </linearGradient>
    <linearGradient id="den-brass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4d98a"/><stop offset="0.5" stop-color="#c89a3a"/><stop offset="1" stop-color="#8a6420"/>
    </linearGradient>
    <linearGradient id="den-duels-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b1055"/><stop offset="0.55" stop-color="#c2386b"/><stop offset="1" stop-color="#f6a13b"/>
    </linearGradient>
    <linearGradient id="den-duels-sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff5a6e"/>
    </linearGradient>
    <linearGradient id="den-arcade-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b0a2a"/><stop offset="1" stop-color="#2a0f4a"/>
    </linearGradient>
    <linearGradient id="den-poster-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.4" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
    </linearGradient>
    <radialGradient id="den-bulb-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd98a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="den-neon-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff4a3a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff2a2a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="den-pine" patternUnits="userSpaceOnUse" width="40" height="8">
      <rect width="40" height="8" fill="#c8925a"/><path d="M0 3q10-2 20 0t20 0M0 6q12 1.5 24 0t16 0" fill="none" stroke="#8a5a2e" stroke-width="0.8" opacity="0.6"/>
    </pattern>
    <radialGradient id="den-slate" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0" stop-color="#3a4a42" stop-opacity="0"/><stop offset="1" stop-color="#0c1310" stop-opacity="0.55"/>
    </radialGradient>
    <linearGradient id="den-polaroid-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#b8a98a" stop-opacity="0.3"/>
    </linearGradient>`
  );
}

// ——— Posters ———

function posterFrame(family: Family, rect: Rect, tilt: number, art: string, paper: string): string {
  const { x, y, width, height } = rect;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const tape = (tx: number, ty: number, angle: number) =>
    `<rect x="${n(tx - 7)}" y="${n(ty - 2.5)}" width="14" height="5" fill="#efe6cf" opacity="0.85" transform="rotate(${angle} ${n(tx)} ${n(ty)})"/>`;
  return (
    `<g class="growth-item growth-poster" data-family="${family}" transform="rotate(${tilt} ${n(cx)} ${n(cy)})">` +
    `<rect x="${x + 2}" y="${y + 3}" width="${width}" height="${height}" fill="#000" opacity="0.3"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${paper}"/>` +
    `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 72 88" overflow="hidden">${art}</svg>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#den-poster-sheen)"/>` +
    tape(x + 4, y + 2, -32) +
    tape(x + width - 4, y + 2, 32) +
    `</g>`
  );
}

function duelsPoster(): string {
  // High noon in neon: a striped sun sinking behind two crossed bolts.
  let stripes = '';
  for (let i = 0; i < 5; i++)
    stripes += `<rect x="12" y="${n(40 + i * 4.4)}" width="48" height="${n(1 + i * 0.5)}" fill="url(#den-duels-sky)"/>`;
  return (
    `<rect width="72" height="88" fill="url(#den-duels-sky)"/>` +
    `<circle cx="36" cy="44" r="20" fill="url(#den-duels-sun)"/>${stripes}` +
    `<path d="M0 62h72v26H0Z" fill="#1a0b33"/>` +
    `<path d="M0 64h72M0 68h72M0 74h72M0 82h72M36 62L10 88M36 62L62 88M36 62L24 88M36 62L48 88" stroke="#ff4fa3" stroke-width="0.7" opacity="0.8"/>` +
    `<path d="M22 22l10 12-5 1 8 12-12-12 5-1Z" fill="#ffe27a" stroke="#1a0b33" stroke-width="0.8"/>` +
    `<path d="M50 22l-10 12 5 1-8 12 12-12-5-1Z" fill="#7df0ff" stroke="#1a0b33" stroke-width="0.8"/>` +
    `<text x="36" y="16" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-style="italic" font-size="15" fill="#fff" stroke="#c2386b" stroke-width="0.6" letter-spacing="1">DUELS</text>`
  );
}

function brainPoster(): string {
  // Memphis confetti around a checkered cube in perspective.
  const rng = createRng('brain-poster');
  let confetti = '';
  const colours = ['#ff6f91', '#ffc93c', '#2ec4b6', '#3a3a8a'];
  for (let i = 0; i < 16; i++) {
    const cx = rng.float(4, 68);
    const cy = rng.float(18, 84);
    const colour = rng.pick(colours);
    const kind = rng.int(0, 2);
    confetti +=
      kind === 0
        ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="1.6" fill="${colour}"/>`
        : kind === 1
          ? `<path d="M${n(cx)} ${n(cy)}l3 -5 3 5Z" fill="${colour}"/>`
          : `<path d="M${n(cx)} ${n(cy)}q2 -3 4 0t4 0" fill="none" stroke="${colour}" stroke-width="1.2"/>`;
  }
  let checks = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) continue;
      // Front face cells.
      checks += `<rect x="${22 + c * 7}" y="${42 + r * 7}" width="7" height="7" fill="#1d1d2b"/>`;
    }
  }
  return (
    `<rect width="72" height="88" fill="#e9f6ef"/>${confetti}` +
    `<path d="M22 42l8-8h28l-8 8Z" fill="#ffffff" stroke="#1d1d2b" stroke-width="1"/>` +
    `<path d="M50 42l8-8v28l-8 8Z" fill="#c9c9d9" stroke="#1d1d2b" stroke-width="1"/>` +
    `<rect x="22" y="42" width="28" height="28" fill="#ffffff" stroke="#1d1d2b" stroke-width="1"/>${checks}` +
    `<text x="36" y="17" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="15" fill="#1d1d2b" letter-spacing="2">BRAIN</text>` +
    `<path d="M14 20h44" stroke="#ff6f91" stroke-width="2"/>`
  );
}

function sportsPoster(): string {
  // Varsity: a stitched ball bursting out of a star, block letters in gold.
  let burst = '';
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    burst += `<path d="M36 48L${n(36 + 34 * Math.cos(a - 0.1))} ${n(48 + 34 * Math.sin(a - 0.1))}L${n(36 + 34 * Math.cos(a + 0.1))} ${n(48 + 34 * Math.sin(a + 0.1))}Z" fill="#23407a"/>`;
  }
  return (
    `<rect width="72" height="88" fill="#16264d"/>${burst}` +
    `<circle cx="36" cy="50" r="17" fill="#f7f3e8" stroke="#c9c0a8" stroke-width="1"/>` +
    `<path d="M24 38q8 12 0 24M48 38q-8 12 0 24" fill="none" stroke="#c8352e" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>` +
    `<text x="36" y="18" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="15" fill="#f2c14e" stroke="#c8352e" stroke-width="0.9" letter-spacing="1">SPORTS</text>` +
    `<path d="M10 80l26-6 26 6" fill="none" stroke="#f2c14e" stroke-width="1.4"/>`
  );
}

function arcadePoster(): string {
  // Neon on midnight: a ringed planet, a rocket and a grid running to the horizon.
  const rng = createRng('arcade-stars');
  let stars = '';
  for (let i = 0; i < 22; i++)
    stars += `<circle cx="${n(rng.float(2, 70))}" cy="${n(rng.float(20, 56))}" r="${n(rng.float(0.3, 0.9))}" fill="#ffffff" opacity="${n(rng.float(0.5, 1))}"/>`;
  let grid = '';
  for (let i = 0; i <= 8; i++) grid += `M36 60L${n(-20 + i * 14)} 88`;
  for (const y of [63, 67, 73, 81]) grid += `M0 ${y}H72`;
  return (
    `<rect width="72" height="88" fill="url(#den-arcade-sky)"/>${stars}` +
    `<circle cx="50" cy="36" r="9" fill="#ff7ac2"/><ellipse cx="50" cy="36" rx="15" ry="4" fill="none" stroke="#7df0ff" stroke-width="1.2" transform="rotate(-18 50 36)"/>` +
    `<path d="M18 50l6-14 6 14-3 2h-6Z" fill="#e9eef5"/><path d="M21 52l-3 4M27 52l3 4" stroke="#ff9f3a" stroke-width="1.6"/><circle cx="24" cy="44" r="1.8" fill="#2ec4b6"/>` +
    `<path d="${grid}" stroke="#ff4fa3" stroke-width="0.7" fill="none"/>` +
    `<path d="M0 60H72" stroke="#7df0ff" stroke-width="1"/>` +
    `<text x="36" y="17" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="15" fill="none" stroke="#7df0ff" stroke-width="1" letter-spacing="1.5">ARCADE</text>`
  );
}

const POSTER_ART: Record<Family, { art: () => string; paper: string; tilt: number }> = {
  duels: { art: duelsPoster, paper: '#2b1055', tilt: -2 },
  brain: { art: brainPoster, paper: '#e9f6ef', tilt: 1.5 },
  sports: { art: sportsPoster, paper: '#16264d', tilt: -1 },
  arcade: { art: arcadePoster, paper: '#0b0a2a', tilt: 2 },
};

/** The families' posters, each in its fixed place in the row so the row never reshuffles. */
export function posters(families: readonly Family[]): string {
  const { x, y, width, height } = LAYOUT.posters;
  // Posters keep their 72×88 artwork's shape at the row's height.
  const posterWidth = Math.round((height * 72) / 88);
  const gap = (width - posterWidth * FAMILIES.length) / (FAMILIES.length - 1);
  return FAMILIES.map((family, index) => {
    if (!families.includes(family)) return '';
    const style = POSTER_ART[family];
    return posterFrame(
      family,
      { x: x + index * (posterWidth + gap), y, width: posterWidth, height },
      style.tilt,
      style.art(),
      style.paper,
    );
  }).join('');
}

// ——— Trophies ———

function trophy(cx: number, baseY: number, manifest: GameManifest): string {
  const w = 14;
  return (
    `<g class="growth-item growth-trophy" data-game="${manifest.id}">` +
    `<ellipse cx="${n(cx)}" cy="${n(baseY)}" rx="${w / 2 + 1}" ry="1.6" fill="#000" opacity="0.35"/>` +
    `<rect x="${n(cx - w / 2)}" y="${n(baseY - 7)}" width="${w}" height="7" rx="1" fill="#3a2418"/>` +
    `<rect x="${n(cx - w / 2 + 2)}" y="${n(baseY - 5.6)}" width="${w - 4}" height="4.2" rx="0.6" fill="${manifest.label.band}"/>` +
    `<path d="M${n(cx - 1.4)} ${n(baseY - 7)}h2.8l-0.6 -4h-1.6Z" fill="url(#den-trophy-gold)"/>` +
    `<path d="M${n(cx - 6)} ${n(baseY - 19)}h12q0 7 -6 8q-6 -1 -6 -8Z" fill="url(#den-trophy-gold)"/>` +
    `<path d="M${n(cx - 6)} ${n(baseY - 17.5)}q-3.5 0 -3 2.6q0.5 2 3.6 2M${n(cx + 6)} ${n(baseY - 17.5)}q3.5 0 3 2.6q-0.5 2 -3.6 2" fill="none" stroke="url(#den-trophy-gold)" stroke-width="1.1"/>` +
    `<path d="M${n(cx - 3.6)} ${n(baseY - 18)}q0.4 4 2.4 5.6" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.6"/>` +
    `</g>`
  );
}

/**
 * Trophy spots: two rows of four in each of the duels and brain rows' empty
 * slot (the back row on a little riser), then along the top of the shelf unit.
 */
function trophySpots(): { cx: number; baseY: number; riser: boolean }[] {
  const spots: { cx: number; baseY: number; riser: boolean }[] = [];
  for (const row of [0, 1]) {
    const slot = wallSlot(row, 7);
    const floor = slot.y + slot.height;
    for (const riser of [true, false]) {
      for (let i = 0; i < 4; i++) {
        spots.push({
          cx: slot.x + 8 + i * 17 + (riser ? 4 : 0),
          baseY: riser ? floor - 14 : floor,
          riser,
        });
      }
    }
  }
  const top = LAYOUT.shelf.y;
  for (let i = 0; i < 14; i++)
    spots.push({ cx: WALL.innerX + 230 + i * 19, baseY: top, riser: false });
  return spots;
}

export function trophies(games: readonly GameManifest[]): string {
  const spots = trophySpots();
  const used = spots.slice(0, games.length);
  const risers = [0, 1]
    .filter((row) =>
      used.some(
        (spot) =>
          spot.riser &&
          Math.abs(spot.baseY - (wallSlot(row, 7).y + wallSlot(row, 7).height - 14)) < 0.5,
      ),
    )
    .map((row) => {
      const slot = wallSlot(row, 7);
      return `<rect x="${slot.x + 2}" y="${slot.y + slot.height - 14}" width="${slot.width + 4}" height="14" fill="#6b4424"/><rect x="${slot.x + 2}" y="${slot.y + slot.height - 14}" width="${slot.width + 4}" height="2" fill="#fff" opacity="0.15"/>`;
    })
    .join('');
  return (
    risers +
    games
      .map((manifest, index) => {
        const spot = used[index];
        return spot ? trophy(spot.cx, spot.baseY, manifest) : '';
      })
      .join('')
  );
}

// ——— Paper chain and string lights ———

export function paperChain(): string {
  const { x, width, y } = LAYOUT.window;
  const colours = ['#e8463a', '#ffc93c', '#2ec4b6', '#7b3fa0', '#f2862c'];
  const links = 34;
  let markup = '';
  for (let i = 0; i < links; i++) {
    const t = i / (links - 1);
    const cx = x + 8 + t * (width - 16);
    const cy = y + 6 + Math.sin(t * Math.PI) * 18;
    const vertical = i % 2 === 0;
    markup += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${vertical ? 3.4 : 6.6}" ry="${vertical ? 6.6 : 3.4}" fill="none" stroke="${colours[i % colours.length] ?? '#e8463a'}" stroke-width="2.6"/>`;
  }
  return `<g class="growth-item growth-chain">${markup}</g>`;
}

const BULB_COLOURS = ['#ff6b5a', '#ffd23f', '#5ad1c8', '#ff9fd1', '#9ad35a'];

function bulbPositions(): { x: number; y: number; colour: string }[] {
  const bulbs: { x: number; y: number; colour: string }[] = [];
  for (let row = 0; row < 4; row++) {
    const top = WALL.firstRowY + row * WALL.rowHeight - 2;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      bulbs.push({
        x: WALL.innerX + 6 + t * (WALL.innerWidth - 12),
        // The wire droops between the hooks at either end.
        y: top + 6 + Math.sin(t * Math.PI * 3) ** 2 * 5,
        colour: BULB_COLOURS[(i + row) % BULB_COLOURS.length] ?? '#ffd23f',
      });
    }
  }
  return bulbs;
}

export function stringLights(): string {
  let wires = '';
  for (let row = 0; row < 4; row++) {
    const top = WALL.firstRowY + row * WALL.rowHeight - 2;
    let d = `M${WALL.innerX} ${top + 4}`;
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      d += `L${n(WALL.innerX + t * WALL.innerWidth)} ${n(top + 4 + Math.sin(t * Math.PI * 3) ** 2 * 5)}`;
    }
    wires += `<path d="${d}" fill="none" stroke="#2a2a22" stroke-width="0.9"/>`;
  }
  const bulbs = bulbPositions()
    .map(
      (bulb) =>
        `<rect x="${n(bulb.x - 1.2)}" y="${n(bulb.y - 1)}" width="2.4" height="2" fill="#3a3a30"/><ellipse cx="${n(bulb.x)}" cy="${n(bulb.y + 3)}" rx="2.1" ry="3" fill="${bulb.colour}"/>`,
    )
    .join('');
  return `<g class="growth-item growth-lights">${wires}${bulbs}</g>`;
}

export function stringLightsGlow(): string {
  return bulbPositions()
    .map(
      (bulb) =>
        `<circle cx="${n(bulb.x)}" cy="${n(bulb.y + 3)}" r="11" fill="url(#den-bulb-glow)" opacity="0.7"/>`,
    )
    .join('');
}

// ——— On the TV and the Counter ———

export function onAirSign(): string {
  const { x, y, width, height } = LAYOUT.onAir;
  return (
    `<g class="growth-item growth-on-air">` +
    `<rect x="${x + 2}" y="${y + height - 3}" width="${width - 4}" height="4" fill="#000" opacity="0.35"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="#1a1416"/>` +
    `<rect x="${x + 4}" y="${y + 4}" width="${width - 8}" height="${height - 8}" rx="3" fill="#2a1a1c" stroke="#3a2a2c"/>` +
    `<text x="${x + width / 2}" y="${y + height / 2 + 7}" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="21" letter-spacing="3" fill="none" stroke="#ff5a4a" stroke-width="1.6" class="neon-tube">ON AIR</text>` +
    `<text x="${x + width / 2}" y="${y + height / 2 + 7}" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="21" letter-spacing="3" fill="none" stroke="#ffd2c8" stroke-width="0.5">ON AIR</text>` +
    `</g>`
  );
}

export function onAirGlow(): string {
  const { x, y, width, height } = LAYOUT.onAir;
  return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width * 0.9}" ry="${height * 1.4}" fill="url(#den-neon-glow)"/>`;
}

export function remote(): string {
  const { x, y, width, height } = LAYOUT.remote;
  let buttons = '';
  for (let i = 0; i < 6; i++)
    buttons += `<rect x="${n(x + 22 + i * 6.6)}" y="${n(y + 4)}" width="4.4" height="3" rx="1" fill="${i === 0 ? '#c8352e' : '#d9cfbf'}"/>`;
  return (
    `<g class="growth-item growth-remote" transform="rotate(-4 ${x + width / 2} ${y + height / 2})">` +
    `<rect x="${x + 1}" y="${y + 3}" width="${width}" height="${height}" rx="3" fill="#000" opacity="0.35"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="#1d1715"/>` +
    `<rect x="${x + 2}" y="${y + 1.5}" width="16" height="${height - 3}" rx="2" fill="url(#den-pine)"/>` +
    buttons +
    `<rect x="${x + width - 6}" y="${y + 4.5}" width="3" height="5" rx="1" fill="#5ad1c8" opacity="0.8"/>` +
    `</g>`
  );
}

export function plaque(): string {
  const { x, y, width, height } = LAYOUT.plaque;
  return (
    `<g class="growth-item growth-plaque">` +
    `<path d="M${x + 8} ${y + height}l6 -6M${x + width - 8} ${y + height}l-6 -6" stroke="#5a4020" stroke-width="2"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height - 6}" rx="2" fill="url(#den-brass)" stroke="#6b4a12" stroke-width="0.8"/>` +
    `<text x="${x + width / 2}" y="${y + (height - 6) / 2 + 3.4}" text-anchor="middle" font-family="var(--font-display)" font-style="italic" font-weight="700" font-size="10" fill="#4a3208">${escapeXml('32 in 1')}</text>` +
    `</g>`
  );
}
