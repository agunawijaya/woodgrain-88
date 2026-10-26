/**
 * Tests for game manifest and registry contract validation, focusing on
 * cartridge version constraints and slot uniqueness.
 */
import { describe, expect, it } from 'vitest';
import {
  type CartridgeVersion,
  type GameManifest,
  validateManifest,
  validateRegistry,
} from '../src/contract.ts';

const VERSION_ONE: CartridgeVersion = {
  id: 'chicken',
  label: 'Chicken',
  cartridgeSlot: 19,
  description: 'A chicken crosses a road marked with solid lane lines.',
};

const VERSION_TWO: CartridgeVersion = {
  id: 'rabbit',
  label: 'Rabbit',
  cartridgeSlot: 11,
  description: 'A rabbit crosses a road with dashed lane lines.',
};

const VALID_MANIFEST: GameManifest = {
  id: 'lane-hopper',
  slot: 11,
  title: 'Lane Hopper',
  tagline: 'Race across lanes of traffic.',
  teaser: 'Hop through the traffic gaps and avoid getting bumped back.',
  family: 'arcade',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [2, 6],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#5f7a12', night: '#c8f25a' },
  emblem: 'M3 9h4M10 9h4M17 9h4M3 15h4M10 15h4M17 15h4M12 21v-2.5M12 6V3',
  label: {
    pattern: 'stripes',
    paper: '#343a40',
    ink: '#ffd60a',
    band: '#8ac926',
    bandText: '#1a3300',
  },
  inspiredBy: {
    originalTitle: 'Freeway',
    uiTitle: 'the road-crossing race',
    publisher: 'Activision',
    year: null,
    cartridgeSlots: [11, 19],
  },
  controls: [{ keys: ['Space'], does: 'hop' }],
  channels: [
    {
      id: 'classic',
      kind: 'original',
      title: 'Classic',
      description: 'Standard traffic patterns.',
    },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
  versions: [VERSION_ONE, VERSION_TWO],
};

const SECOND_VALID_MANIFEST: GameManifest = {
  ...VALID_MANIFEST,
  id: 'pier-derby',
  slot: 15,
  title: 'Pier Derby',
  inspiredBy: {
    ...VALID_MANIFEST.inspiredBy,
    cartridgeSlots: [15, 26],
  },
  versions: [
    {
      id: 'derby',
      label: 'Derby',
      cartridgeSlot: 26,
      description: 'The derby as it shipped: pond and anglers.',
    },
    {
      id: 'hack',
      label: 'Hack',
      cartridgeSlot: 15,
      description: 'The other copy: new colours and anglers.',
    },
  ],
};

describe('manifest and registry contract validation', () => {
  it('reports each cartridge version problem in validateManifest and passes a valid manifest with versions', () => {
    expect(validateManifest(VALID_MANIFEST)).toEqual([]);

    // Fewer than two versions
    const fewerThanTwo: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE],
    };
    expect(validateManifest(fewerThanTwo)).toContain(
      `${VALID_MANIFEST.id}: versions must list at least two cartridge versions`,
    );

    // Non-kebab id
    const nonKebab: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, id: 'Not_Kebab' }],
    };
    expect(validateManifest(nonKebab)).toContain(
      `${VALID_MANIFEST.id}: version Not_Kebab needs a kebab-case id`,
    );

    // Duplicate id
    const duplicateId: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, id: VERSION_ONE.id }],
    };
    expect(validateManifest(duplicateId)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_ONE.id} is listed twice`,
    );

    // Label of 0 characters
    const emptyLabel: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, label: '' }],
    };
    expect(validateManifest(emptyLabel)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_TWO.id}: label must be 1–24 characters`,
    );

    // Label of more than 24 characters
    const longLabel: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, label: 'A'.repeat(25) }],
    };
    expect(validateManifest(longLabel)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_TWO.id}: label must be 1–24 characters`,
    );

    // Description of 0 characters
    const emptyDesc: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, description: '' }],
    };
    expect(validateManifest(emptyDesc)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_TWO.id}: description must be 1–140 characters`,
    );

    // Description of more than 140 characters
    const longDesc: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, description: 'A'.repeat(141) }],
    };
    expect(validateManifest(longDesc)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_TWO.id}: description must be 1–140 characters`,
    );

    // cartridgeSlot not in inspiredBy.cartridgeSlots
    const unlistedSlot: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, cartridgeSlot: 30 }],
    };
    expect(validateManifest(unlistedSlot)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_TWO.id}: cartridgeSlot must be one of inspiredBy.cartridgeSlots`,
    );

    // Two versions on the same cartridge slot
    const duplicateSlot: GameManifest = {
      ...VALID_MANIFEST,
      versions: [VERSION_ONE, { ...VERSION_TWO, cartridgeSlot: VERSION_ONE.cartridgeSlot }],
    };
    expect(validateManifest(duplicateSlot)).toContain(
      `${VALID_MANIFEST.id}: version ${VERSION_TWO.id}: cartridge slot ${VERSION_ONE.cartridgeSlot} is already a version`,
    );
  });

  it('reports two games claiming the same version cartridge slot in validateRegistry', () => {
    const conflictingGame: GameManifest = {
      ...SECOND_VALID_MANIFEST,
      inspiredBy: {
        ...SECOND_VALID_MANIFEST.inspiredBy,
        cartridgeSlots: [19, 26],
      },
      versions: [
        {
          id: 'derby',
          label: 'Derby',
          cartridgeSlot: 26,
          description: 'The derby as it shipped: pond and anglers.',
        },
        {
          id: 'hack',
          label: 'Hack',
          cartridgeSlot: 19,
          description: 'The other copy: new colours and anglers.',
        },
      ],
    };

    const problems = validateRegistry([VALID_MANIFEST, conflictingGame]);
    expect(problems).toContain('version cartridge slot 19 is used 2 times');

    const validRegistryProblems = validateRegistry([VALID_MANIFEST, SECOND_VALID_MANIFEST]);
    expect(validRegistryProblems).toEqual([]);
  });
});
