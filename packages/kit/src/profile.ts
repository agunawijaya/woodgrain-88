/**
 * The player's profile: a local id, a display name and a code-drawn avatar
 * descriptor. Prompt 01 builds the jacket and the Neighbourhood Kids on top;
 * this is the stub they need.
 */
import type { Rng } from './rng.ts';
import type { Repository } from './store/repos.ts';
import type { AvatarDescriptor, ProfileData } from './store/types.ts';

export const DISPLAY_NAME_MAX = 20;

export type NameCheck = { ok: true; value: string } | { ok: false; reason: string };

const AVATAR_SHAPES: readonly AvatarDescriptor['shape'][] = ['round', 'square', 'tall'];
const AVATAR_PATTERNS: readonly AvatarDescriptor['pattern'][] = [
  'plain',
  'stripes',
  'dots',
  'checks',
];

// Common English profanity stored ROT13-encoded so source files remain clean,
// chosen carefully to avoid false positives on names like Scunthorpe or Cassandra.
const ROT13_DENY_LIST: readonly string[] = [
  'shpx',
  'fuvg',
  'ovgpu',
  'nffubyr',
  'onfgneq',
  'jnaxre',
  'fyhg',
  'juber',
  'cvff',
];

function decodeRot13(encoded: string): string {
  return encoded.replace(/[a-z]/gi, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

const DENY_LIST: readonly string[] = ROT13_DENY_LIST.map(decodeRot13);

const LEET_MAP = new Map<string, string>([
  ['0', 'o'],
  ['1', 'i'],
  ['3', 'e'],
  ['4', 'a'],
  ['5', 's'],
  ['7', 't'],
  ['@', 'a'],
  ['$', 's'],
]);

function hasControlCharacters(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function normalizeForDenyCheck(input: string): string {
  const lower = input.toLowerCase();
  const mapped = lower.replace(/[013457@$]/g, (ch) => LEET_MAP.get(ch) ?? ch);
  return mapped.replace(/[^a-z0-9]/g, '');
}

/**
 * Trims and collapses inner whitespace, then requires 1–DISPLAY_NAME_MAX
 * characters, no control characters, and nothing on a small deny-list of
 * rude words (matched case-insensitively, ignoring spaces, punctuation and
 * common digit-for-letter swaps). Reasons are short and kind, e.g.
 * "Pick a name with 1 to 20 characters." or "Let's pick a different name."
 */
export function validateDisplayName(name: string): NameCheck {
  const collapsed = name.replace(/[ \u00a0]+/g, ' ').replace(/^ | $/g, '');
  if (collapsed.length < 1 || collapsed.length > DISPLAY_NAME_MAX) {
    return { ok: false, reason: 'Pick a name with 1 to 20 characters.' };
  }

  if (hasControlCharacters(collapsed)) {
    return { ok: false, reason: 'Letters, numbers and spaces work best.' };
  }

  const normalized = normalizeForDenyCheck(collapsed);
  for (const word of DENY_LIST) {
    if (normalized.includes(word)) {
      return { ok: false, reason: "Let's pick a different name." };
    }
  }

  return { ok: true, value: collapsed };
}

export function randomAvatar(rng: Rng): AvatarDescriptor {
  return {
    hue: rng.int(0, 359),
    shape: rng.pick(AVATAR_SHAPES),
    pattern: rng.pick(AVATAR_PATTERNS),
  };
}

export interface ProfileApi {
  get(): ProfileData;
  rename(name: string): NameCheck;
  setAvatar(avatar: AvatarDescriptor): void;
}

function wrapHue(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  return ((Math.trunc(hue) % 360) + 360) % 360;
}

export function createProfile(repo: Repository<ProfileData>): ProfileApi {
  return {
    get() {
      return repo.get();
    },
    rename(name) {
      const check = validateDisplayName(name);
      if (check.ok) {
        repo.update((draft) => {
          draft.displayName = check.value;
        });
      }
      return check;
    },
    setAvatar(avatar) {
      repo.update((draft) => {
        draft.avatar = {
          hue: wrapHue(avatar.hue),
          shape: avatar.shape,
          pattern: avatar.pattern,
        };
      });
    },
  };
}
