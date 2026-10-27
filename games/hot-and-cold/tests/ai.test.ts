import { describe, expect, it } from 'vitest';
import { createKidPlayer, type KidPlayer } from '../src/ai/kid.ts';
import { nextMove, stepsBetween } from '../src/ai/path.ts';
import { HUNT_STYLES } from '../src/ai/styles.ts';
import { squareAt, stepFrom } from '../src/engine/grid.ts';
import { createMatch, startMatch, stepMatch } from '../src/engine/match.ts';
import { cartridgeRules, shortened, type Rules } from '../src/engine/rules.ts';
import { playMatch } from '../src/sim/play.ts';

describe('getting about the field', () => {
  it('counts steps on the wrapped field: corner to corner is one step', () => {
    expect(stepsBetween(squareAt(0, 0), squareAt(8, 6))).toBe(1);
    expect(stepsBetween(squareAt(0, 0), squareAt(4, 3))).toBe(4);
  });

  it('walks round the other explorer when it stands on the only shortest way', () => {
    // From the top-left corner to (6, 4) the shortest way wraps through the bottom-right corner.
    const from = squareAt(0, 0);
    const to = squareAt(6, 4);
    const rival = squareAt(8, 6);
    const move = nextMove(from, to, rival);
    expect(move).not.toBeNull();
    if (!move) return;
    expect(stepFrom(from, move.east, move.south)).not.toBe(rival);
  });

  it('never steps onto the other explorer and arrives in the fewest steps the way allows', () => {
    // The rival stands right between: the walk goes round it, still in two steps.
    const rival = squareAt(4, 3);
    let here = squareAt(3, 3);
    const target = squareAt(5, 3);
    let steps = 0;
    while (here !== target && steps < 20) {
      const move = nextMove(here, target, rival);
      if (!move) break;
      here = stepFrom(here, move.east, move.south);
      expect(here).not.toBe(rival);
      steps++;
    }
    expect(here).toBe(target);
    expect(steps).toBe(2);
  });

  it('has nowhere to go when the target is where the other explorer stands', () => {
    expect(nextMove(squareAt(0, 0), squareAt(2, 2), squareAt(2, 2))).toBeNull();
  });
});

describe('the Kids at the table', () => {
  const race = shortened(cartridgeRules(1));

  function kid(
    id: 'lou' | 'pip' | 'moss' | 'dee',
    seat: 0 | 1,
    seed: string,
    clues: 'classic' | 'notebook' = 'classic',
  ): KidPlayer {
    return createKidPlayer({ kid: id, seat, memory: 'human', clues, seed });
  }

  it('finishes every kind of match it can be seated at', () => {
    for (const variation of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const rules: Rules = shortened(cartridgeRules(variation));
      const played = playMatch(
        { rules, seats: 2, switches: ['B', 'B'], seed: `finish/${variation}` },
        [kid('lou', 0, 'a'), kid('dee', 1, 'b')],
      );
      expect(played.result, `variation ${variation}`).not.toBeNull();
    }
  });

  it('plays the same match the same way from the same seeds', () => {
    const play = () =>
      playMatch({ rules: race, seats: 2, switches: ['B', 'B'], seed: 'replay' }, [
        kid('moss', 0, 'a'),
        kid('pip', 1, 'b'),
      ]);
    expect(play()).toEqual(play());
  });

  it('never looks at where the flag is: the match’s hidden fields are off limits', () => {
    const match = createMatch({ rules: race, seats: 2, switches: ['B', 'B'], seed: 'honest' });
    const players = [kid('lou', 0, 'a', 'notebook'), kid('dee', 1, 'b')] as const;
    const hidden = new Set(['flags', 'headings', 'board', 'rng']);
    const visible = new Proxy(match, {
      get(target, property, receiver) {
        if (typeof property === 'string' && hidden.has(property)) {
          throw new Error(`a Kid read match.${property}`);
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    let events = startMatch(match);
    while (!match.result && match.tick < 60_000) {
      for (const player of players) player.hear(events, visible);
      events = stepMatch(match, [players[0].input(visible), players[1].input(visible)]);
    }
    expect(match.result).not.toBeNull();
  });

  it('remembers its own checks and notices some of the rival’s in Classic Memory', () => {
    const lou = kid('lou', 0, 'a');
    const dee = kid('dee', 1, 'b');
    playMatch({ rules: race, seats: 2, switches: ['B', 'B'], seed: 'memory' }, [lou, dee]);
    const learned = lou.memory.log.filter((event) => event.kind === 'learned').length;
    const missed = lou.memory.log.filter((event) => event.kind === 'missed').length;
    expect(learned).toBeGreaterThan(5);
    expect(missed).toBeGreaterThan(0);
  });

  it('keeps no memory in Notebook mode: the clues stay on the field for everyone', () => {
    const lou = kid('lou', 0, 'a', 'notebook');
    playMatch({ rules: race, seats: 2, switches: ['B', 'B'], seed: 'notebook' }, [
      lou,
      kid('dee', 1, 'b', 'notebook'),
    ]);
    expect(lou.memory.log).toEqual([]);
  });

  it('gives Lou the slowest walk and Dee the quickest decisions', () => {
    const pauses = Object.values(HUNT_STYLES).map((style) => style.stepPause);
    expect(HUNT_STYLES.lou.stepPause).toBe(Math.max(...pauses));
    const thinking = Object.values(HUNT_STYLES).map((style) => style.think);
    expect(HUNT_STYLES.dee.think).toBe(Math.min(...thinking));
  });

  it('waits for its turn in turns, and checks once a turn', () => {
    const rules = shortened(cartridgeRules(2));
    const match = createMatch({ rules, seats: 2, switches: ['B', 'B'], seed: 'turns' });
    const players = [kid('moss', 0, 'a'), kid('pip', 1, 'b')] as const;
    let events = startMatch(match);
    let lastChecker: number | null = null;
    while (!match.result && match.tick < 60_000) {
      for (const player of players) player.hear(events, match);
      events = stepMatch(match, [players[0].input(match), players[1].input(match)]);
      for (const event of events) {
        if (event.type === 'check' && event.check.clue.kind !== 'flag') {
          expect(event.check.seat).not.toBe(lastChecker);
          lastChecker = event.check.seat;
        }
        if (event.type === 'round') lastChecker = null;
      }
    }
    expect(match.result).not.toBeNull();
  });
});
