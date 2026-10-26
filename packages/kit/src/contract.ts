/**
 * The contract between The Den and a game (docs/adr/0002-game-contract.md).
 *
 * A game is two things the Hall knows about:
 *
 * - its manifest: plain data, bundled with the Hall, enough to draw its
 *   cartridge label, its card, its channels, its patches and today's pick
 *   without loading any game code;
 * - its module: loaded with a dynamic import only when the game is opened,
 *   providing `mount` (play) and `demo` (the Den's TV).
 *
 * A coming-soon game is a manifest without a module. Everything a running
 * game needs from outside arrives through `GameContext`; a game never reaches
 * into the Hall, and never touches storage, the URL or the document outside
 * its host element.
 */
import type { AudioEngine } from './audio.ts';
import { validateChannels, type ChannelDef } from './channels.ts';
import { parseColor, contrastRatio } from './color.ts';
import type { Unsubscribe } from './emitter.ts';
import { validateEventSchemas, type GameEvent, type GameEventSchema } from './events.ts';
import type { InputController, Seat } from './input.ts';
import type { GameLoop, LoopOptions } from './loop.ts';
import type { MicroBrief, MicroChallengeDef, MicroResult } from './micro.ts';
import type { PatchDef, PatchEarned, PatchStatus } from './patches.ts';
import type { Rng } from './rng.ts';
import type { KidId } from './kids.ts';
import type { GameSettingsStore } from './settings.ts';
import type { Challenge, ShareCardInput } from './share.ts';
import type { RunRecord } from './store/types.ts';
import {
  FAMILIES,
  type Appearance,
  type DifficultySwitches,
  type Family,
  type RunMode,
  type ScoreOrder,
} from './types.ts';

export type GameStatus = 'playable' | 'coming-soon';
export type PlayersLabel = '1P' | '1–2P' | '2P';
export type Versus = 'none' | 'local' | 'local+bot';

/** The code-drawn label patterns every cartridge label is built from. */
export const LABEL_PATTERNS = [
  'stripes',
  'sunburst',
  'checker',
  'waves',
  'grid',
  'dots',
  'chevrons',
  'rings',
  'diamonds',
  'bricks',
  'zigzag',
  'scales',
  'plaid',
  'stars',
  'ripples',
  'blocks',
] as const;
export type LabelPattern = (typeof LABEL_PATTERNS)[number];

/**
 * Data for a game's cartridge label. Labels are objects in the room, so the
 * colours are the same by day and by night; the room's light does the rest.
 */
export interface LabelArt {
  pattern: LabelPattern;
  /** The label's field. */
  paper: string;
  /** The pattern's ink on the field. */
  ink: string;
  /** The title band across the label. */
  band: string;
  /** Title text on the band; must meet AA against `band`. */
  bandText: string;
  /** Degrees the pattern is turned. Default 0. */
  angle?: number;
  /** A larger illustration on the label, path data on a 24×24 grid. Defaults to the emblem. */
  motif?: string;
}

/** A short control hint for cards, the pause menu and How to play. */
export interface ControlHint {
  keys: readonly string[];
  does: string;
  /** Which seat it is for in versus; omitted when it applies to everyone. */
  seat?: Seat;
}

export interface InspiredBy {
  /** The original program's name. Credits, About and docs only, never the game's UI. */
  originalTitle: string;
  /** How the UI may refer to it, e.g. "the 1977 tank duel". */
  uiTitle: string;
  publisher: string;
  /** null when not confirmed against a cited source; shown as "late 1970s / early 1980s". */
  year: number | null;
  /** The cartridge's own slot numbers (1–32); two for a merged pair. */
  cartridgeSlots: readonly number[];
}

/**
 * One program of the 1988 cartridge that a game plays. Two pairs of programs
 * on the cartridge are near-copies, and each pair became one game that offers
 * both as versions: the player picks one in the game's settings or on its
 * details overlay, and the Hall passes the choice to the game in `run.version`.
 * The first version listed is the default (ADR-0002, amended for prompt 00a).
 */
export interface CartridgeVersion {
  /** kebab-case and stable forever: it is saved per game and kept in records of play. */
  id: string;
  /** What the player picks, at most 24 characters, e.g. "Rabbit". */
  label: string;
  /** The cartridge program this version follows (1–32); one of `inspiredBy.cartridgeSlots`. */
  cartridgeSlot: number;
  /** One sentence on what is different, at most 140 characters. */
  description: string;
}

export interface GameManifest {
  /** kebab-case: the folder under games/ and the route (#/game/<id>, #/play/<id>). */
  id: string;
  /** 1–30: the fixed place on the Counter and the Label Wall. */
  slot: number;
  /** Our own title, at most 22 characters. Never an original title or a trademark. */
  title: string;
  /** One line for the card, at most 80 characters. */
  tagline: string;
  /** Two or three sentences, at most 320 characters. */
  teaser: string;
  family: Family;
  players: PlayersLabel;
  versus: Versus;
  /** A typical session, [shortest, longest] minutes. */
  sessionMinutes: readonly [number, number];
  status: GameStatus;
  /** Whether a bigger or a smaller score is better. */
  scoreOrder: ScoreOrder;
  /** The game's signature colour, tuned separately for day and night. */
  accent: { day: string; night: string };
  /**
   * SVG path data on a 24×24 grid, drawn as one round-capped stroke about
   * 1.75 units wide; dots are zero-length segments ("M12 12h0"). It must read
   * at 20 px.
   */
  emblem: string;
  label: LabelArt;
  inspiredBy: InspiredBy;
  controls: readonly ControlHint[];
  /** Curated variations, ids stable forever. At least one. */
  channels: readonly ChannelDef[];
  supports: {
    daily: boolean;
    challengeLinks: boolean;
    microChallenges: boolean;
  };
  /** Leave out when the game never reads the switches. */
  difficulty?: DifficultyMeaning;
  events: readonly GameEventSchema[];
  /** Only for a game made from two near-identical cartridge programs: at least two, default first. */
  versions?: readonly CartridgeVersion[];
}

/** Who sits in each seat. A bot seat is always one of the Neighbourhood Kids. */
export interface SeatInfo {
  seat: Seat;
  kind: 'human' | 'bot';
  name: string;
  /** Set exactly when `kind` is 'bot'; map it onto the game's AI with `aiSettings`. */
  kid?: KidId;
}

/** What one difficulty switch does in this game, shown in its details as "A: …  B: …". */
export interface SwitchMeaning {
  /** At most 60 characters each. */
  a: string;
  b: string;
}

/**
 * What the console's difficulty switches mean in this game, as on its
 * original: the left switch for the left player, the right for the right.
 */
export interface DifficultyMeaning {
  left: SwitchMeaning;
  /** Leave out when the game only reads the left switch. */
  right?: SwitchMeaning;
  /**
   * True when a switch flipped mid-run takes effect from the next round; false
   * when it waits for the next game. Either way the change is never instant.
   */
  liveChange: boolean;
}

/** What kind of run this is and how it is seeded. */
export interface RunInfo {
  mode: RunMode;
  seed: number;
  channel: string;
  /** Set in daily mode. */
  dailyNumber?: number;
  /** Set when the run is a micro-challenge (Power Cycle Run). */
  micro?: MicroBrief;
  /** Set when the player opened a challenge link: the score to beat. */
  challenge?: Challenge;
  /** The chosen `CartridgeVersion` id; set exactly when the manifest declares versions. */
  version?: string;
}

export interface GameResult {
  score: number;
  /** How the score reads on the results card, e.g. "3–1", "42 strokes", "12,400". */
  scoreLabel: string;
  durationMs: number;
  /** Single player: whether the run counts as a win. */
  won?: boolean;
  /** Versus: the winning seat, or null for a draw. */
  winnerSeat?: Seat | null;
  /** Up to four extra lines for the results card. */
  details?: readonly { label: string; value: string }[];
  /**
   * The run in at most 12 emoji for the daily share line, e.g. "🟩🟩🟥🟩" for
   * rounds won and lost. Plain emoji only: no letters, digits or names.
   */
  emoji?: string;
  /** 'hall' asks the chrome to show the standard results screen; 'game' means the game shows its own. */
  presentation: 'hall' | 'game';
}

/** What the kit worked out from a reported result, for a game that presents its own results. */
export interface ResultReceipt {
  newBest: boolean;
  /** Place on this channel and mode's top ten, or null. */
  rank: number | null;
  patchesEarned: readonly PatchEarned[];
  micro: MicroResult | null;
}

export interface PauseItem {
  id: string;
  label: string;
  onSelect(): void;
}

export type GameView = 'menu' | 'play' | 'results';

/** What a game may read about settings, live. */
export interface GameSettingsView {
  appearance(): Appearance;
  onAppearance(listener: (appearance: Appearance) => void): Unsubscribe;
  reducedMotion(): boolean;
  onReducedMotion(listener: (reduced: boolean) => void): Unsubscribe;
  screenShake(): boolean;
  crtEnabled(): boolean;
  colorBlindHints(): boolean;
  /** The game's own settings namespace. */
  game: GameSettingsStore;
}

/** One save slot per game, in the game's own versioned format. */
export interface SaveSlot {
  /** The saved state if it was stored with this version, else null. Validate it before use. */
  load(version: number): unknown;
  store(version: number, state: unknown): void;
  clear(): void;
}

export interface GameContext {
  readonly manifest: GameManifest;
  readonly run: RunInfo;
  /** Seeded from `run.seed`; fork it for independent streams. */
  readonly rng: Rng;
  readonly seats: readonly SeatInfo[];
  /** Two-seat input bound to the game's host; Escape is already wired to the pause menu. */
  readonly input: InputController;
  readonly audio: AudioEngine;
  readonly settings: GameSettingsView;
  /**
   * The console's two difficulty switches. Read them when a round starts; a
   * flip during the run arrives through `onChange` and applies from the next
   * round or game, as the manifest's `difficulty.liveChange` says.
   */
  readonly difficulty: {
    get(): DifficultySwitches;
    onChange(listener: (switches: DifficultySwitches) => void): Unsubscribe;
  };
  readonly save: SaveSlot;
  readonly patches: { status(): PatchStatus[] };
  readonly records: {
    best(channel: string, mode: RunMode): RunRecord | null;
    top(channel: string, mode: RunMode): RunRecord[];
  };
  /** A loop that the chrome pauses with the game (hidden tab, pause menu). */
  createLoop(options: LoopOptions): GameLoop;
  emit(event: GameEvent): void;
  /** Records, stats, patches and micro-challenge are all settled here, once per run. */
  reportResult(result: GameResult): ResultReceipt;
  readonly share: {
    /** A challenge link for this run's channel and seed with `score` to beat. */
    challengeLink(score: number): string;
    /** An SVG share card with this game's title, accent and the current appearance. */
    card(input: Pick<ShareCardInput, 'subtitle' | 'lines'>): string;
    copy(text: string): Promise<boolean>;
  };
  /** Tells the chrome what the player is looking at, so it shows the right buttons. */
  setView(view: GameView): void;
  /** Game-specific pause-menu items, shown between Resume and How to play. */
  setPauseItems(items: readonly PauseItem[]): void;
  /** Opens the pause menu (for a game's own pause button or a gamepad Start press). */
  requestPause(): void;
  openSettings(): void;
  openHowToPlay(): void;
  /** Leaves to the Den, asking first if `leaveCheck` says progress would be lost. */
  backToHall(): void;
  /** Clears this game's save, records, stats and progress after the player confirms. */
  forgetGameData(): void;
}

export interface GameInstance {
  /** Freeze simulation, audio and timers. */
  pause(reason: 'menu' | 'hidden'): void;
  resume(): void;
  /** Show the game's own menu (title screen). */
  gameMenu(): void;
  /** Start another run with the same settings: "Play again" or, in versus, "Rematch". */
  playAgain(): void;
  leaveCheck(): 'safe' | 'would-lose-progress';
  dispose(): void;
}

export interface DemoContext {
  appearance: Appearance;
  reducedMotion: boolean;
  /** The picture size in CSS pixels; demos draw at about 320×240 and the CRT scales it. */
  width: number;
  height: number;
  /** The cartridge version to show, for a game that declares versions. */
  version?: string;
}

/**
 * The game's attract loop for the Den's TV: silent, cheap, loops forever,
 * draws into its own canvas, follows appearance changes and stops cleanly.
 */
export interface DemoHandle {
  readonly surface: HTMLCanvasElement;
  setAppearance(appearance: Appearance): void;
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

/** The game's How to play panel. */
export interface HowToPlayCard {
  /** One or two sentences: what you are trying to do. */
  goal: string;
  controls: readonly ControlHint[];
  tips?: readonly string[];
}

export interface GameModule {
  manifest: GameManifest;
  /** Club, Pro, Legend and an optional secret patch, thresholds visible to players. */
  patches: readonly PatchDef[];
  microChallenges?: readonly MicroChallengeDef[];
  howToPlay: HowToPlayCard;
  /**
   * Starts the game inside `host`, which it owns until `dispose()`. It opens on
   * its game menu unless `context.run.mode` asks for a specific run (daily,
   * challenge, micro), in which case it starts that run straight away.
   */
  mount(host: HTMLElement, context: GameContext): GameInstance;
  demo(host: HTMLElement, seed: number, context: DemoContext): DemoHandle;
}

/** What the Hall's registry holds per game: always a manifest, a module loader once playable. */
export interface GameEntry {
  manifest: GameManifest;
  load?: () => Promise<GameModule>;
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;

function colorProblem(name: string, value: string): string | null {
  try {
    parseColor(value);
    return null;
  } catch {
    return `${name} "${value}" is not a colour`;
  }
}

/** Every problem with a manifest, each prefixed with its id; empty when valid. */
export function validateManifest(manifest: GameManifest): string[] {
  const problems: string[] = [];
  const add = (problem: string) => problems.push(`${manifest.id}: ${problem}`);

  if (!KEBAB.test(manifest.id)) add('id must be kebab-case');
  if (!Number.isInteger(manifest.slot) || manifest.slot < 1 || manifest.slot > 30)
    add('slot must be 1–30');
  if (manifest.title.length === 0 || manifest.title.length > 22)
    add('title must be 1–22 characters');
  if (manifest.tagline.length === 0 || manifest.tagline.length > 80)
    add('tagline must be 1–80 characters');
  if (manifest.teaser.length === 0 || manifest.teaser.length > 320)
    add('teaser must be 1–320 characters');
  if (!FAMILIES.includes(manifest.family)) add(`unknown family ${manifest.family}`);
  if (manifest.players === '1P' && manifest.versus !== 'none') add('a 1P game has no versus');
  if (manifest.players !== '1P' && manifest.versus === 'none')
    add('a two-player game needs a versus mode');
  const [shortest, longest] = manifest.sessionMinutes;
  if (!(shortest >= 1 && longest >= shortest && longest <= 90))
    add('sessionMinutes must be 1 ≤ a ≤ b ≤ 90');

  for (const [name, value] of [
    ['accent.day', manifest.accent.day],
    ['accent.night', manifest.accent.night],
    ['label.paper', manifest.label.paper],
    ['label.ink', manifest.label.ink],
    ['label.band', manifest.label.band],
    ['label.bandText', manifest.label.bandText],
  ] as const) {
    const problem = colorProblem(name, value);
    if (problem) add(problem);
  }
  if (problems.length === 0 && contrastRatio(manifest.label.bandText, manifest.label.band) < 4.5) {
    add('label.bandText must meet AA (4.5:1) against label.band');
  }
  if (!manifest.emblem.trim() || !PATH_DATA.test(manifest.emblem))
    add('emblem must be SVG path data');
  if (manifest.label.motif !== undefined && !PATH_DATA.test(manifest.label.motif)) {
    add('label.motif must be SVG path data');
  }
  const slots = manifest.inspiredBy.cartridgeSlots;
  if (slots.length === 0 || slots.some((s) => !Number.isInteger(s) || s < 1 || s > 32)) {
    add('inspiredBy.cartridgeSlots must list cartridge slots 1–32');
  }
  if (manifest.controls.length === 0) add('controls must list at least one hint');
  problems.push(...validateChannels(manifest.channels).map((p) => `${manifest.id}: ${p}`));
  problems.push(...validateEventSchemas(manifest.events).map((p) => `${manifest.id}: ${p}`));
  problems.push(...versionProblems(manifest).map((p) => `${manifest.id}: ${p}`));
  problems.push(...difficultyProblems(manifest).map((p) => `${manifest.id}: ${p}`));
  return problems;
}

function difficultyProblems(manifest: GameManifest): string[] {
  const { difficulty } = manifest;
  if (difficulty === undefined) return [];
  const problems: string[] = [];
  const sides = [['left', difficulty.left], ['right', difficulty.right]] as const;
  for (const [side, meaning] of sides) {
    if (meaning === undefined) continue;
    for (const position of ['a', 'b'] as const) {
      const text = meaning[position];
      if (text.length === 0 || text.length > 60)
        problems.push(`difficulty.${side}.${position} must be 1–60 characters`);
    }
  }
  return problems;
}

function versionProblems(manifest: GameManifest): string[] {
  const versions = manifest.versions;
  if (versions === undefined) return [];
  const problems: string[] = [];
  if (versions.length < 2) problems.push('versions must list at least two cartridge versions');
  const ids = new Set<string>();
  const slots = new Set<number>();
  for (const version of versions) {
    if (!KEBAB.test(version.id)) problems.push(`version ${version.id} needs a kebab-case id`);
    if (ids.has(version.id)) problems.push(`version ${version.id} is listed twice`);
    ids.add(version.id);
    if (version.label.length === 0 || version.label.length > 24)
      problems.push(`version ${version.id}: label must be 1–24 characters`);
    if (version.description.length === 0 || version.description.length > 140)
      problems.push(`version ${version.id}: description must be 1–140 characters`);
    if (!manifest.inspiredBy.cartridgeSlots.includes(version.cartridgeSlot))
      problems.push(`version ${version.id}: cartridgeSlot must be one of inspiredBy.cartridgeSlots`);
    if (slots.has(version.cartridgeSlot))
      problems.push(`version ${version.id}: cartridge slot ${version.cartridgeSlot} is already a version`);
    slots.add(version.cartridgeSlot);
  }
  return problems;
}

/** Problems across a whole registry: each manifest, plus unique ids, slots and version cartridge slots. */
export function validateRegistry(manifests: readonly GameManifest[]): string[] {
  const problems = manifests.flatMap(validateManifest);
  const seen = (label: string, values: readonly (string | number)[]) => {
    const counts = new Map<string | number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    for (const [value, count] of counts)
      if (count > 1) problems.push(`${label} ${value} is used ${count} times`);
  };
  seen(
    'id',
    manifests.map((m) => m.id),
  );
  seen(
    'slot',
    manifests.map((m) => m.slot),
  );
  seen(
    'version cartridge slot',
    manifests.flatMap((m) => (m.versions ?? []).map((v) => v.cartridgeSlot)),
  );
  return problems;
}
