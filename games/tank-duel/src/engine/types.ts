/**
 * The shapes the duel engine works with: what a channel's rules are, what a
 * seat's controller says, and what every vehicle, shell and match looks like
 * from one fixed step to the next. Everything is plain data so a match can be
 * stepped headless (bots, simulations, tests) exactly as it runs on screen.
 */
import type { Vec2 } from './vec.ts';
import type { Shell } from './shell.ts';

/** Seat 0 starts on the left, seat 1 on the right. */
export type Side = 0 | 1;

export type VehicleClass = 'tank' | 'biplane' | 'jet' | 'bomber';

export type ShotKind = 'straight' | 'guided' | 'machine-gun';

export type ChannelGroup = 'Tanks' | 'Invisible Tanks' | 'Biplanes' | 'Jets' | 'Remix';

/** Extra rules a Remix channel adds on top of its base rules. */
export type RemixRule =
  /** Only shells that bounced score, and a hit is worth one point per bounce. */
  | { readonly kind: 'ricochet-royale' }
  /** Both tanks always unseen; a radar sweep shows them now and then; firing still reveals. */
  | { readonly kind: 'blackout'; readonly sweepEvery: number; readonly sweepShows: number }
  /** The afterburner burns fuel that refills while cruising. */
  | { readonly kind: 'ace-duel'; readonly fuelSeconds: number; readonly refillPerSecond: number }
  /** One hit wins a short round; first to win enough rounds wins the match. */
  | { readonly kind: 'last-tank'; readonly roundSeconds: number; readonly roundsToWin: number };

export interface ChannelRules {
  readonly id: string;
  /** Position on the dial, from 1. */
  readonly number: number;
  readonly title: string;
  readonly kind: 'original' | 'remix';
  readonly group: ChannelGroup;
  /** The 1977 variation this channel plays, 1–27; null for Remix. */
  readonly originalGame: number | null;
  /** Which board it is played on: an arena id (`arenas/layouts.ts`) or a sky id (`arenas/skies.ts`). */
  readonly field:
    { readonly kind: 'arena'; readonly id: string } | { readonly kind: 'sky'; readonly id: string };
  /** What each side flies or drives. */
  readonly vehicles: readonly [VehicleClass, VehicleClass];
  /** How many of them each side has, flying in formation. */
  readonly formation: readonly [number, number];
  readonly shot: ShotKind;
  readonly walls: 'stop' | 'bounce';
  readonly billiard: boolean;
  readonly invisible: boolean;
  readonly remix: RemixRule | null;
}

/**
 * A seat's controller this step, as the stick reads: x is left (-1) or right (+1), y is down (-1)
 * or up (+1). The engine turns it into turning and throttle per vehicle class (`controls.ts`).
 */
export interface StickInput {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
  readonly fire: boolean;
}

export const NO_INPUT: StickInput = { x: 0, y: 0, fire: false };

/** What the vehicle does with a stick, after the class and cartridge wiring are applied. */
export interface Intent {
  /** -1 turns anticlockwise on screen, +1 clockwise. */
  readonly turn: -1 | 0 | 1;
  /** Tanks: 1 drives forward, otherwise they stop. Aircraft: -1 slow, 0 cruise, 1 fast. */
  readonly throttle: -1 | 0 | 1;
  readonly fire: boolean;
}

export interface VehicleState {
  /** Unique within a match; a side's formation leader has the lowest id of that side. */
  readonly id: number;
  readonly side: Side;
  readonly vehicle: VehicleClass;
  /** 0 is the formation leader; shots are fired from the leader. */
  readonly slot: number;
  readonly position: Vec2;
  /** Heading step, an integer 0–15 (see `vec.ts`). */
  readonly heading: number;
  /** Seconds until the next heading step while the stick is held to one side. */
  readonly turnTimer: number;
  /** Current speed, units per second. */
  readonly speed: number;
  readonly radius: number;
  /** Seconds a driving tank has been pressed against something (it slides free after a moment). */
  readonly wedged: number;
  /** Seconds left of the reveal an invisible tank gets from bumping. */
  readonly bumped: number;
}

/** The pause after a scoring hit: the victim's side spins and is shoved, nobody steers. */
export interface Freeze {
  readonly seconds: number;
  readonly victim: Side;
  /** Unit direction the killing shot was travelling, for the knockback. */
  readonly shove: Vec2;
  /** Fractional heading steps accumulated by the spin, so it runs at a fixed rate whatever the step. */
  readonly spinCarry: number;
}

export type ScoringRule = 'timed' | 'first-to-10';

export interface MatchOptions {
  readonly scoring: ScoringRule;
  /** Difficulty switch A per seat: shorter shots and slower aircraft (a handicap, as in 1977). */
  readonly handicap: readonly [boolean, boolean];
  /** The 32-in-1 cartridge's biplane wiring: up and down turn, left and right set the speed. */
  readonly wiring: boolean;
  /** Not in 1977 (the Reverse gear setting): pulling back drives a tank slowly backwards. */
  readonly reverseGear?: boolean;
  /**
   * Not in 1977 (the Own ricochets setting): a shell that has bounced off a wall can hit the side
   * that fired it, and the point goes to the other side.
   */
  readonly ownRicochets?: boolean;
}

export interface MatchState {
  readonly channel: ChannelRules;
  readonly options: MatchOptions;
  /** Seconds since the match started. */
  readonly time: number;
  /** Seconds left on the round clock (timed scoring and Last Tank rounds); Infinity otherwise. */
  readonly clock: number;
  readonly scores: readonly [number, number];
  readonly vehicles: readonly VehicleState[];
  /** At most one shell per side in the air. */
  readonly shells: readonly [Shell | null, Shell | null];
  /** Seconds until each side's machine gun can fire again. */
  readonly reload: readonly [number, number];
  /** Whether each side's fire button was down last step (a new press fires; holding only repeats the machine gun). */
  readonly fireHeld: readonly [boolean, boolean];
  readonly freeze: Freeze | null;
  /** Ace Duel afterburner fuel per side, seconds of full burn left. */
  readonly fuel: readonly [number, number];
  /** Blackout: seconds until the next sweep, and seconds the current sweep still shows. */
  readonly radar: { readonly next: number; readonly showing: number };
  /** Last Tank: the round being played, from 1 (scores count rounds won there). */
  readonly round: number;
  readonly over: boolean;
  /** The winning side, or null for a draw (also null while the match runs). */
  readonly winner: Side | null;
}

export type MatchEvent =
  | {
      readonly kind: 'fired';
      readonly side: Side;
      readonly at: Vec2;
      readonly direction: Vec2;
      readonly shot: ShotKind;
    }
  | {
      readonly kind: 'bounced';
      readonly side: Side;
      readonly at: Vec2;
      readonly normal: Vec2;
      /** Bounces so far this flight; the ricochet ping rises with it. */
      readonly bounces: number;
      readonly corner: boolean;
    }
  | {
      readonly kind: 'shell-gone';
      readonly side: Side;
      readonly at: Vec2;
      readonly reason: 'expired' | 'wall' | 'cleared';
    }
  | {
      readonly kind: 'hit';
      readonly shooter: Side;
      readonly victim: Side;
      /** Which vehicle of the victim's side was struck. */
      readonly vehicle: number;
      readonly at: Vec2;
      readonly direction: Vec2;
      readonly bounces: number;
      readonly points: number;
      /** The shell's path from the muzzle through every bounce to the hit, for the replay and the bank trace. */
      readonly path: readonly Vec2[];
    }
  | {
      /** A shell that had bounced came back and struck its own side: one point to the other side. */
      readonly kind: 'own-hit';
      readonly side: Side;
      /** Which vehicle of that side was struck. */
      readonly vehicle: number;
      readonly at: Vec2;
      readonly direction: Vec2;
      readonly bounces: number;
      readonly path: readonly Vec2[];
    }
  | { readonly kind: 'turned'; readonly vehicle: number; readonly heading: number }
  | { readonly kind: 'bumped'; readonly vehicle: number; readonly at: Vec2 }
  | { readonly kind: 'spin-over'; readonly victim: Side }
  | { readonly kind: 'warning' }
  | { readonly kind: 'radar' }
  | { readonly kind: 'round-over'; readonly winner: Side | null; readonly round: number }
  | { readonly kind: 'match-over'; readonly winner: Side | null };

export interface MatchStep {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
}
