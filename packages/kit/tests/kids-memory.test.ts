import { describe, expect, it } from 'vitest';
import {
  createKidMemory,
  FORGET_BELOW,
  KID_MEMORY,
  memoryProfile,
  salienceOf,
  SHARP_MEMORY,
  type FactAdapter,
  type MemoryProfile,
} from '../src/kids/memory.ts';
import { createRng, type Rng } from '../src/rng.ts';

interface Note {
  readonly id: string;
  readonly value: number;
}

const notes: FactAdapter<Note> = {
  key: (note) => note.id,
  distort: (note) => ({ ...note, value: note.value + 1 }),
};

const plain: MemoryProfile = {
  capacity: 10,
  halfLife: 10,
  distortion: 0,
  attention: 1,
  rehearsal: false,
  salience: { own: 1, theirs: 1, striking: 1 },
};

/**
 * An Rng whose `chance` answers come from a script, recording the probabilities asked for. Any
 * other draw, or a `chance` beyond the script, fails the test: the memory must use only the
 * draws its contract describes.
 */
function scripted(answers: readonly boolean[]): Rng & { readonly asked: number[] } {
  const queue = [...answers];
  const asked: number[] = [];
  const refuse = () => {
    throw new Error('unexpected draw');
  };
  return {
    asked,
    seed: 0,
    next: refuse,
    int: refuse,
    float: refuse,
    pick: refuse,
    shuffle: refuse,
    fork: refuse,
    chance(probability) {
      asked.push(probability);
      const answer = queue.shift();
      if (answer === undefined) throw new Error(`no scripted answer for chance(${probability})`);
      return answer;
    },
  };
}

const note = (id: string, value = 0): Note => ({ id, value });

describe('Kid memory profiles', () => {
  it('gives each Kid the capacity, half-life, distortion and attention of the brief', () => {
    const table = Object.fromEntries(
      Object.entries(KID_MEMORY).map(([id, p]) => [
        id,
        [p.capacity, p.halfLife, p.distortion, p.attention],
      ]),
    );
    expect(table).toEqual({
      lou: [9, 120, 0.02, 0.9],
      moss: [7, 90, 0.04, 0.8],
      rosa: [6, 60, 0.06, 0.85],
      benny: [6, 60, 0.05, 0.95],
      dee: [4, 30, 0.1, 0.5],
      pip: [3, 20, 0.18, 0.4],
    });
  });

  it('lets only Lou and Moss rehearse what they use', () => {
    const rehearsers = Object.entries(KID_MEMORY)
      .filter(([, profile]) => profile.rehearsal)
      .map(([id]) => id);
    expect(rehearsers.sort()).toEqual(['lou', 'moss']);
  });

  it('makes the player’s finds stick better with Rosa and Benny, who watch the player', () => {
    expect(KID_MEMORY.rosa.salience.theirs).toBeGreaterThan(KID_MEMORY.lou.salience.theirs);
    expect(KID_MEMORY.benny.salience.theirs).toBeGreaterThan(KID_MEMORY.lou.salience.theirs);
  });

  it('switches every Kid to perfect recall in sharp mode', () => {
    expect(memoryProfile('pip', 'sharp')).toBe(SHARP_MEMORY);
    expect(memoryProfile('pip', 'human')).toBe(KID_MEMORY.pip);
    expect(SHARP_MEMORY).toMatchObject({
      capacity: Infinity,
      halfLife: Infinity,
      distortion: 0,
      attention: 1,
    });
  });

  it('weighs a fact by its source and, when striking, by the striking weight too', () => {
    const profile = { ...plain, salience: { own: 1.3, theirs: 0.9, striking: 2 } };
    expect(salienceOf(profile, 'own', false)).toBeCloseTo(1.3);
    expect(salienceOf(profile, 'theirs', false)).toBeCloseTo(0.9);
    expect(salienceOf(profile, 'theirs', true)).toBeCloseTo(1.8);
  });
});

describe('Kid memory: learning and fading', () => {
  it('recalls a fresh fact without drawing anything, since its strength is at least 1', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a', 3), 1, 0);
    expect(memory.recall(0, scripted([]))).toEqual([note('a', 3)]);
  });

  it('halves an unused fact’s strength every half-life and recalls it with that chance', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a'), 1, 0);
    const rng = scripted([false, true]);
    expect(memory.recall(10, rng)).toEqual([]);
    expect(memory.recall(10, rng)).toEqual([note('a')]);
    expect(rng.asked[0]).toBeCloseTo(0.5);
  });

  it('keeps a fact that slipped this time: a failed recall is not forgetting', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a'), 1, 0);
    memory.recall(10, scripted([false]));
    expect(memory.summary().kept).toEqual([note('a')]);
    expect(memory.log.map((event) => event.kind)).toEqual(['learned']);
  });

  it('forgets for good a fact that has faded below the threshold, without a draw', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a'), 1, 0);
    // After 2.5 half-lives the strength is about 0.18, under FORGET_BELOW.
    expect(FORGET_BELOW).toBe(0.25);
    expect(memory.recall(25, scripted([]))).toEqual([]);
    expect(memory.recall(25, scripted([]))).toEqual([]);
    expect(memory.log.map((event) => event.kind)).toEqual(['learned', 'forgotten']);
    expect(memory.summary().forgotten).toEqual([note('a')]);
  });

  it('lets a striking fact (higher salience) outlast a routine one', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('bomb'), 2, 0);
    memory.observe(note('routine'), 1, 0);
    // At 25 s the routine fact is at 0.18 (gone); the striking one is at 0.35.
    const rng = scripted([true]);
    expect(memory.recall(25, rng)).toEqual([note('bomb')]);
    expect(rng.asked[0]).toBeCloseTo(2 * Math.pow(0.5, 2.5));
  });

  it('never fades a fact when the half-life is infinite', () => {
    const memory = createKidMemory({ ...plain, halfLife: Infinity }, notes);
    memory.observe(note('a'), 1, 0);
    expect(memory.recall(1e9, scripted([]))).toEqual([note('a')]);
  });

  it('refreshes a recalled fact when the profile rehearses', () => {
    const memory = createKidMemory({ ...plain, rehearsal: true }, notes);
    memory.observe(note('a'), 1, 0);
    memory.recall(10, scripted([true]));
    const rng = scripted([true]);
    memory.recall(20, rng);
    // Refreshed at 10 s, so at 20 s it is one half-life old again.
    expect(rng.asked[0]).toBeCloseTo(0.5);
  });

  it('does not refresh a recalled fact when the profile does not rehearse', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a'), 1, 0);
    memory.recall(10, scripted([true]));
    const rng = scripted([true]);
    memory.recall(20, rng);
    expect(rng.asked[0]).toBeCloseTo(0.25);
  });

  it('treats learning the same fact again as a refresh, not a second fact', () => {
    const memory = createKidMemory({ ...plain, capacity: 1 }, notes);
    memory.observe(note('a', 1), 1, 0);
    memory.observe(note('a', 2), 1, 10);
    expect(memory.recall(10, scripted([]))).toEqual([note('a', 2)]);
    expect(memory.log.map((event) => event.kind)).toEqual(['learned']);
  });

  it('recalls facts in the order they were first learned', () => {
    const memory = createKidMemory({ ...plain, halfLife: Infinity }, notes);
    memory.observe(note('b'), 1, 0);
    memory.observe(note('a'), 1, 1);
    memory.observe(note('c'), 1, 2);
    expect(memory.recall(2, scripted([])).map((fact) => fact.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('Kid memory: capacity', () => {
  it('pushes out the weakest fact when a new one arrives at capacity', () => {
    const memory = createKidMemory({ ...plain, capacity: 2 }, notes);
    memory.observe(note('weak'), 1, 0);
    memory.observe(note('strong'), 2, 0);
    memory.observe(note('new'), 1, 0);
    expect(memory.recall(0, scripted([])).map((fact) => fact.id)).toEqual(['strong', 'new']);
    expect(memory.log.at(-1)).toEqual({ kind: 'pushed-out', fact: note('weak'), at: 0 });
  });

  it('pushes out the oldest of equally weak facts, and always keeps the newest', () => {
    const memory = createKidMemory({ ...plain, capacity: 2 }, notes);
    memory.observe(note('first'), 1, 0);
    memory.observe(note('second'), 1, 0);
    memory.observe(note('third'), 0.5, 0);
    expect(memory.summary().kept.map((fact) => fact.id)).toEqual(['second', 'third']);
  });

  it('judges weakness by strength now, after fading', () => {
    const memory = createKidMemory({ ...plain, capacity: 2 }, notes);
    memory.observe(note('old-strong'), 1.5, 0);
    memory.observe(note('young'), 1, 20);
    memory.observe(note('newest'), 1, 20);
    // At 20 s the old fact has faded to 0.375, weaker than the young one.
    expect(memory.summary().kept.map((fact) => fact.id)).toEqual(['young', 'newest']);
  });

  it('holds any number of facts when capacity is infinite', () => {
    const memory = createKidMemory(SHARP_MEMORY, notes);
    for (let index = 0; index < 500; index++) memory.observe(note(`n${index}`, index), 1, index);
    expect(memory.recall(1e6, scripted([]))).toHaveLength(500);
  });
});

describe('Kid memory: distortion', () => {
  it('can bring a faded fact back slightly wrong, and the Kid then believes the wrong version', () => {
    const memory = createKidMemory({ ...plain, distortion: 0.6 }, notes);
    memory.observe(note('a', 4), 2, 0);
    // One half-life on: strength 1 (no retrieval draw), half faded, so wrong with 0.6 × 0.5.
    const rng = scripted([true]);
    expect(memory.recall(10, rng)).toEqual([note('a', 5)]);
    expect(rng.asked[0]).toBeCloseTo(0.3);
    expect(memory.summary().kept).toEqual([note('a', 5)]);
    expect(memory.log.at(-1)).toEqual({
      kind: 'misremembered',
      fact: note('a', 4),
      at: 10,
      became: note('a', 5),
    });
  });

  it('recalls a fresh fact exactly, without a draw: fresh memories are vivid', () => {
    const memory = createKidMemory({ ...plain, distortion: 1 }, notes);
    memory.observe(note('a', 4), 1, 5);
    expect(memory.recall(5, scripted([]))).toEqual([note('a', 4)]);
  });

  it('blurs a fact more the further it has faded', () => {
    const chanceAt = (age: number) => {
      const memory = createKidMemory({ ...plain, distortion: 0.5 }, notes);
      memory.observe(note('a'), 8, 0);
      const rng = scripted([false]);
      memory.recall(age, rng);
      return rng.asked[0] ?? 0;
    };
    expect(chanceAt(10)).toBeCloseTo(0.25);
    expect(chanceAt(20)).toBeCloseTo(0.375);
    expect(chanceAt(20)).toBeGreaterThan(chanceAt(10));
  });

  it('draws for retrieval before distortion, and does not distort a fact that slipped', () => {
    const memory = createKidMemory({ ...plain, distortion: 0.3 }, notes);
    memory.observe(note('a'), 1, 0);
    const rng = scripted([false]);
    memory.recall(10, rng);
    expect(rng.asked).toHaveLength(1);
    expect(rng.asked[0]).toBeCloseTo(0.5);
  });

  it('reports the original truth and the latest belief for a fact mixed up twice', () => {
    const memory = createKidMemory({ ...plain, distortion: 1 }, notes);
    memory.observe(note('a', 1), 2, 0);
    memory.recall(10, scripted([true]));
    memory.recall(10, scripted([true]));
    expect(memory.summary().misremembered).toEqual([{ truth: note('a', 1), belief: note('a', 3) }]);
  });

  it('never draws for distortion when the profile has none', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a'), 1, 0);
    expect(memory.recall(0, scripted([]))).toEqual([note('a')]);
  });
});

describe('Kid memory: attention to the other player', () => {
  it('notices what the other player revealed with the profile’s attention', () => {
    const memory = createKidMemory({ ...plain, attention: 0.4 }, notes);
    const rng = scripted([true]);
    expect(memory.witness(note('theirs'), 1, 0, rng)).toBe(true);
    expect(rng.asked).toEqual([0.4]);
    expect(memory.recall(0, scripted([]))).toEqual([note('theirs')]);
  });

  it('logs what it missed and does not learn it', () => {
    const memory = createKidMemory({ ...plain, attention: 0.4 }, notes);
    expect(memory.witness(note('theirs'), 1, 3, scripted([false]))).toBe(false);
    expect(memory.recall(3, scripted([]))).toEqual([]);
    expect(memory.log).toEqual([{ kind: 'missed', fact: note('theirs'), at: 3 }]);
    expect(memory.summary().missed).toEqual([note('theirs')]);
  });

  it('notices everything without a draw when attention is total', () => {
    const memory = createKidMemory(SHARP_MEMORY, notes);
    expect(memory.witness(note('theirs'), 1, 0, scripted([]))).toBe(true);
  });
});

describe('Kid memory: rounds, summary and determinism', () => {
  it('drops every fact on forgetAll but keeps the log for the results screen', () => {
    const memory = createKidMemory(plain, notes);
    memory.observe(note('a'), 1, 0);
    memory.forgetAll();
    expect(memory.recall(0, scripted([]))).toEqual([]);
    expect(memory.summary().kept).toEqual([]);
    expect(memory.log.map((event) => event.kind)).toEqual(['learned']);
  });

  it('counts faded and pushed-out facts as forgotten in the summary', () => {
    const memory = createKidMemory({ ...plain, capacity: 1 }, notes);
    memory.observe(note('pushed'), 1, 0);
    memory.observe(note('faded'), 1, 0);
    memory.recall(30, scripted([]));
    expect(memory.summary().forgotten).toEqual([note('pushed'), note('faded')]);
  });

  it('replays exactly from the same seed: same recalls, same log', () => {
    const run = () => {
      const memory = createKidMemory(KID_MEMORY.pip, notes);
      const rng = createRng('memory-replay');
      const recalled: string[][] = [];
      for (let step = 0; step < 40; step++) {
        const time = step * 3;
        if (step % 2 === 0) memory.observe(note(`own${step}`, step), 1.3, time);
        else memory.witness(note(`theirs${step}`, step), 1, time, rng);
        recalled.push(memory.recall(time, rng).map((fact) => `${fact.id}:${fact.value}`));
      }
      return { recalled, log: memory.log };
    };
    expect(run()).toEqual(run());
  });

  it('gives Pip a much shakier memory than Lou over the same stream of facts', () => {
    const heldAfter = (profile: MemoryProfile) => {
      const memory = createKidMemory(profile, notes);
      const rng = createRng('pip-versus-lou');
      let recalled = 0;
      for (let step = 0; step < 30; step++) {
        memory.observe(note(`n${step}`, step), 1.3, step * 4);
        recalled += memory.recall(step * 4, rng).length;
      }
      return recalled;
    };
    expect(heldAfter(KID_MEMORY.lou)).toBeGreaterThan(heldAfter(KID_MEMORY.pip) * 2);
  });
});
