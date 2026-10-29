---
id: tb-app-data
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/app/settings.ts
  - games/trailblaze/src/app/save.ts
  - games/trailblaze/src/doodle/**
  - games/trailblaze/tests/app/**
  - games/trailblaze/tests/doodle/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/app games/trailblaze/tests/doodle
  - pnpm exec eslint games/trailblaze/src/app games/trailblaze/src/doodle games/trailblaze/tests/app games/trailblaze/tests/doodle
  - pnpm exec prettier --check games/trailblaze/src/app games/trailblaze/src/doodle games/trailblaze/tests/app games/trailblaze/tests/doodle
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/look/look.ts
  - games/trailblaze/src/look/looks.ts
  - games/trailblaze/src/look/seats.ts
  - games/trailblaze/src/session/match-session.ts
  - games/hot-and-cold/src/app/settings.ts
  - games/hot-and-cold/src/app/save.ts
  - games/hot-and-cold/tests
  - packages/kit/src/settings.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/kids.ts
---

## Goal

Trailblaze's settings, save data and Doodle export: the data side of the screens that come next.
Hot & Cold's `app/settings.ts` and `app/save.ts` are the house pattern (kit stores only, never
`localStorage`, versioned save with a tolerant reader); follow them closely.

## 1. Settings — `src/app/settings.ts`

```ts
export type OpponentChoice =
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'computer' }
  | { readonly kind: 'person' };
export interface TrailblazeSettings {
  readonly look: LookId; // default 'neon'
  readonly matchLength: 10 | 5; // points to win; default 10 (the cartridge)
  readonly colourBlind: boolean; // default false: seat palette 'colour-blind' when true
  readonly reducedEffects: boolean; // default false: fewer particles, no camera shake
  readonly camera: 'overhead' | 'chase'; // default 'overhead'
  readonly switches: readonly [SwitchPosition, SwitchPosition]; // left rider, right rider; default B, B
  readonly lastChannel: string; // channel id; default 'game-1'
  readonly opponent: OpponentChoice; // default Rosa
}
export const DEFAULT_TRAILBLAZE_SETTINGS: TrailblazeSettings;
export interface TrailblazeSettingsStore {
  /* as Hot & Cold: read, update(patch), subscribe */
}
export function createTrailblazeSettings(store: GameSettingsStore): TrailblazeSettingsStore;
```

Unknown or malformed stored values fall back to the default for that field only (a stored look
that no longer exists becomes 'neon', an opponent naming an unknown Kid becomes Rosa).

## 2. Save — `src/app/save.ts`

```ts
export interface RecordLine {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  /** Best winning margin, e.g. 10–4 is 6; 0 until a win. */
  readonly bestMargin: number;
  /** Longest the player rode in one point, in seconds. */
  readonly longestRide: number;
}
export interface DoodleEntry {
  readonly id: string; // `${savedAt}-${channelId}`
  readonly channelId: string;
  readonly look: LookId;
  readonly savedAt: number; // ms since epoch, from the caller
  /** The board as `encodeBoard` packs it. */
  readonly board: string;
  readonly filledPercent: number;
}
export interface TrailblazeSave {
  readonly version: number;
  /** Keyed by `recordKey(channelId, opponent, memory)`. */
  readonly records: Readonly<Record<string, RecordLine>>;
  /** Newest first, at most DOODLE_GALLERY_SIZE. */
  readonly doodles: readonly DoodleEntry[];
  readonly tutorialDone: boolean;
}
export const SAVE_VERSION = 1;
export const DOODLE_GALLERY_SIZE = 12;
export function emptySave(): TrailblazeSave;
/** `game-3|kid:rosa|human`, `game-2|computer|-`, `game-1|person|-`. */
export function recordKey(channelId: string, opponent: OpponentChoice, memory: MemoryMode): string;
export function readSave(slot: SaveSlot): TrailblazeSave; // tolerant, as Hot & Cold
export function writeSave(slot: SaveSlot, save: TrailblazeSave): void;
export interface FinishedMatch {
  readonly channelId: string;
  readonly opponent: OpponentChoice;
  readonly memory: MemoryMode;
  readonly playerScore: number;
  readonly rivalScore: number;
  readonly longestRideSeconds: number;
}
export function recordMatch(save: TrailblazeSave, match: FinishedMatch): TrailblazeSave;
export function addDoodle(save: TrailblazeSave, entry: DoodleEntry): TrailblazeSave; // newest first, capped
export function finishTutorial(save: TrailblazeSave): TrailblazeSave;
```

A tie (10–10) counts as played, neither won nor lost. Saves are immutable values: every function
returns a new object.

## 3. Doodle — `src/doodle/board.ts` and `src/doodle/svg.ts`

```ts
// board.ts
/** Packs CELL_COUNT cell contents (EMPTY, BORDER, seat 0, seat 1) into a short ASCII string. */
export function encodeBoard(cells: Int8Array): string;
/** The reverse; null for a string that is not a packed board. */
export function decodeBoard(text: string): Int8Array | null;
/** Share of the non-border cells holding trail, 0–100, rounded down. */
export function filledPercent(cells: Int8Array): number;

// svg.ts
export interface DoodleArt {
  readonly cells: Int8Array;
  /** Tick each cell was laid on, to join the trail in the order it was drawn; optional. */
  readonly laidAt?: Int32Array;
  readonly look: LookId;
  readonly appearance: Appearance;
  readonly palette: SeatPalette;
}
/** A standalone SVG document of the drawing, 1600 × 800, in the look's palette. */
export function doodleSvg(art: DoodleArt): string;
```

- `encodeBoard`: two bits per cell are enough; use a URL-safe base64 alphabet. Round-trips exactly.
- `doodleSvg`: background `lookById(look).background(appearance)`; each seat's cells in its
  `seatColours(palette)` colours; 40 px per cell. Draw each seat's trail as rounded strokes through
  cell centres: join two neighbouring cells of the same seat (8-neighbourhood) when their `laidAt`
  differ by at most 15 ticks, otherwise draw the cell as a short stub on its own; without `laidAt`
  join every same-seat neighbour in the 4-neighbourhood. One `<path>` per seat (merge segments), so
  a full board stays under 200 KB. Per look, a different stroke treatment, all made from SVG
  primitives only (no images, no external fonts, no scripts):
  - `neon`: stroke width 14, the `main` colour, plus a wider soft copy under it with a
    `feGaussianBlur` glow filter.
  - `trains`: a `deep` stroke 18 wide (the bed), and over it a dashed `main` stroke 6 wide
    (`stroke-dasharray` like sleepers).
  - `mummy`: a cream stroke 20 wide (`#efe3c8`) with a `main` stroke 4 wide offset along each edge
    (draw it as two thinner strokes either side, or as one 24-wide `main` stroke under the cream
    one).
  - `ice`: a `deep` stroke 18 wide under a white stroke 6 wide at 0.7 opacity (the ridge's sheen).
    The SVG must be valid XML: escape nothing user-written (there is none), include `xmlns`, a
    `viewBox`, and a `<title>Trailblaze doodle</title>`.

## Tests required

- Settings: defaults; a round trip through a fake kit settings store (copy the fake Hot & Cold's
  tests use); malformed stored values fall back per field.
- Save: `recordKey` forms; `recordMatch` for a win, a loss and a tie, with `bestMargin` and
  `longestRide` kept as maxima; doodle gallery newest first and capped at 12; `readSave` of
  garbage gives `emptySave()`; writing then reading gives the same value.
- Doodle: encode/decode round trip on an empty board, a bordered board and a random one (seeded
  with the kit rng); `decodeBoard` rejects wrong lengths and characters; `filledPercent` on known
  boards; `doodleSvg` for each look parses as XML (use `DOMParser` if the test environment has it,
  otherwise check the outline with regular expressions: one root `<svg`, balanced tags, no
  `<script`, no `href=` to anything but `#` ids) and a full board stays under 200 KB.

Keep the suite under 5 s.

## Out of scope

Screens, the controller, the Hall, sound, rendering in three.js, and anything outside the fence.
