/**
 * Sharing without a server: challenge links that carry a game, channel, seed
 * and score to beat in the URL hash, and an SVG share card the player can copy
 * or download.
 *
 * Links carry a short checksum so a hand-edited score is caught and the link
 * opens as a plain game instead. It is tamper-evident, not secure: anyone
 * reading this code can compute it, and nothing here needs it to be stronger.
 */
import type { Appearance } from './types.ts';

export interface Challenge {
  game: string;
  channel: string;
  seed: number;
  /** The score to beat. */
  score: number;
}

const KEBAB_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEED_INT_RE = /^(?:0|[1-9]\d*)$/;
const SCORE_NUM_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const MAX_UINT32 = 4294967295;
const MAX_ABS_SCORE = 1e9;

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch] ?? ch);
}

/** Six base-36 characters derived from the canonical form of the challenge. */
export function challengeChecksum(challenge: Challenge): string {
  const canonical = `${challenge.game}|${challenge.channel}|${challenge.seed}|${challenge.score}`;
  const text = `woodgrain-88/challenge/${canonical}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const base36 = (hash >>> 0).toString(36);
  return base36.padStart(6, '0').slice(-6);
}

/** "#/play/<game>?mode=challenge&ch=<channel>&seed=<seed>&beat=<score>&sig=<checksum>" */
export function encodeChallenge(challenge: Challenge): string {
  const sig = challengeChecksum(challenge);
  const game = encodeURIComponent(challenge.game);
  const ch = encodeURIComponent(challenge.channel);
  const seed = encodeURIComponent(String(challenge.seed));
  const beat = encodeURIComponent(String(challenge.score));
  const encodedSig = encodeURIComponent(sig);
  return `#/play/${game}?mode=challenge&ch=${ch}&seed=${seed}&beat=${beat}&sig=${encodedSig}`;
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Reads a challenge from a location hash (with or without the leading "#").
 * Null when any part is missing, malformed, out of range (seed a 32-bit
 * unsigned integer, score finite and within ±1e9, ids kebab-case) or the
 * checksum does not match.
 */
export function decodeChallenge(hash: string): Challenge | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0) return null;

  const path = raw.slice(0, queryIndex);
  const query = raw.slice(queryIndex + 1);
  if (!path.startsWith('/play/')) return null;

  const game = decodePathSegment(path.slice('/play/'.length));
  if (game === null || !KEBAB_ID_RE.test(game)) return null;

  const params = new URLSearchParams(query);
  if (params.get('mode') !== 'challenge') return null;

  const channel = params.get('ch');
  const seedRaw = params.get('seed');
  const beatRaw = params.get('beat');
  const sig = params.get('sig');
  if (channel === null || seedRaw === null || beatRaw === null || sig === null) {
    return null;
  }
  if (!KEBAB_ID_RE.test(channel)) return null;
  if (!SEED_INT_RE.test(seedRaw) || !SCORE_NUM_RE.test(beatRaw)) return null;

  const seed = Number(seedRaw);
  const score = Number(beatRaw);
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) return null;
  if (!Number.isFinite(score) || score < -MAX_ABS_SCORE || score > MAX_ABS_SCORE) return null;

  const challenge: Challenge = { game, channel, seed, score };
  if (sig !== challengeChecksum(challenge)) return null;
  return challenge;
}

export interface ShareCardInput {
  /** The game's title, e.g. "Paint Tanks". */
  title: string;
  /** e.g. "Daily #12" or "Channel: Ricochet Alley". */
  subtitle: string;
  /** Two to four short lines: the score, a detail, a challenge line. */
  lines: readonly string[];
  /** The game's accent for this appearance. */
  accent: string;
  appearance: Appearance;
  /** The game's emblem path data on a 24×24 grid. */
  emblem?: string;
}

/**
 * A self-contained 1200×630 SVG document (no external fonts, images or
 * links; text uses a system font stack and is XML-escaped) with a woodgrain
 * band, the emblem, the title, the lines and "Woodgrain '88" in the corner.
 * Light and dark cards are designed separately, not inverted.
 */
export function renderShareCard(input: ShareCardInput): string {
  const isLight = input.appearance === 'light';
  const fontStack = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const accent = escapeXml(input.accent);
  const title = escapeXml(input.title);
  const subtitle = escapeXml(input.subtitle);
  const visibleLines = input.lines.slice(0, 4);

  const bgStart = isLight ? '#fbf6ea' : '#151824';
  const bgEnd = isLight ? '#efe4ce' : '#241b17';
  const glowColor = isLight ? '#fffdf7' : '#3d291b';
  const woodBase = isLight ? '#613d22' : '#2b1a10';
  const woodDark = isLight ? '#442915' : '#1a0f09';
  const woodHighlight = isLight ? '#7c5130' : '#42291a';
  const cardSurface = isLight ? '#fffaf0' : '#1e202b';
  const cardBorder = isLight ? '#d8c7a8' : '#3a342e';
  const textPrimary = isLight ? '#23180f' : '#f5ebd9';
  const textSecondary = isLight ? '#5c4433' : '#c7b59d';

  const emblemMarkup =
    input.emblem !== undefined && input.emblem.length > 0
      ? [
          '<g transform="translate(980, 76) scale(4.5)">',
          `<path d="${escapeXml(input.emblem)}" fill="none" stroke="${accent}"`,
          ' stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
          '</g>',
        ].join('')
      : '';

  const lineElements = visibleLines
    .map((line, index) => {
      const y = 330 + index * 56;
      const weight = index === 0 ? '700' : '500';
      const size = index === 0 ? '36' : '28';
      const fill = index === 0 ? textPrimary : textSecondary;
      const open = `<text x="96" y="${y}" fill="${fill}" font-family="${fontStack}"`;
      return `${open} font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`;
    })
    .join('');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">',
    '<defs>',
    '<linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0%" stop-color="${bgStart}"/>`,
    `<stop offset="100%" stop-color="${bgEnd}"/>`,
    '</linearGradient>',
    '<radialGradient id="warm-glow" cx="0.8" cy="0.2" r="0.7">',
    `<stop offset="0%" stop-color="${glowColor}" stop-opacity="0.55"/>`,
    `<stop offset="100%" stop-color="${glowColor}" stop-opacity="0"/>`,
    '</radialGradient>',
    '</defs>',
    '<rect width="1200" height="630" fill="url(#bg-grad)"/>',
    '<rect width="1200" height="630" fill="url(#warm-glow)"/>',
    `<rect x="44" y="40" width="1112" height="550" rx="20" fill="${cardSurface}"`,
    ` stroke="${cardBorder}" stroke-width="3"/>`,
    `<rect x="44" y="440" width="1112" height="96" fill="${woodBase}"/>`,
    '<path d="M44 458 C 320 446, 620 472, 900 454 C 1020 448, 1100 462, 1156 456"',
    ` fill="none" stroke="${woodDark}" stroke-width="4"/>`,
    '<path d="M44 486 C 280 502, 540 470, 840 492 C 980 500, 1080 482, 1156 490"',
    ` fill="none" stroke="${woodHighlight}" stroke-width="3"/>`,
    '<path d="M44 516 C 360 504, 700 528, 1156 510"',
    ` fill="none" stroke="${woodDark}" stroke-width="3"/>`,
    `<rect x="44" y="434" width="1112" height="8" fill="${accent}"/>`,
    emblemMarkup,
    `<text x="96" y="140" fill="${textPrimary}" font-family="${fontStack}"`,
    ` font-size="60" font-weight="800">${title}</text>`,
    `<text x="96" y="196" fill="${accent}" font-family="${fontStack}"`,
    ` font-size="30" font-weight="600">${subtitle}</text>`,
    lineElements,
    `<text x="1104" y="568" text-anchor="end" fill="${textSecondary}"`,
    ` font-family="${fontStack}" font-size="22" font-weight="700">Woodgrain '88</text>`,
    '</svg>',
  ].join('');
}

/** Copies text to the clipboard; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Offers text as a file download through a temporary object URL. */
export function downloadText(fileName: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
