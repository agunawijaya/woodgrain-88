/**
 * Tests for colour accessibility: cartridge label readability and day/night
 * UI design token contrast ratios against WCAG 2.x standards.
 */
import { contrastRatio } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/data/registry.ts';
import tokens from '../src/styles/tokens.css?raw';
import { fakeManifest } from './fixtures/fake-game.ts';

function parseTokensBlock(css: string, selectorPattern: RegExp): Record<string, string> {
  const match = selectorPattern.exec(css);
  if (!match?.[1]) {
    throw new Error(`Could not find token block matching ${selectorPattern.source}`);
  }
  const blockContent = match[1];
  const tokenMap: Record<string, string> = {};
  const tokenRegex = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]+);/g;
  let tokenMatch: RegExpExecArray | null;
  while ((tokenMatch = tokenRegex.exec(blockContent)) !== null) {
    const name = tokenMatch[1];
    const value = tokenMatch[2];
    if (name !== undefined && value !== undefined) {
      tokenMap[name] = value;
    }
  }
  return tokenMap;
}

const DAY_SELECTOR = /\[data-appearance=['"]light['"]\]\s*\{([^}]+)\}/;
const NIGHT_SELECTOR = /\[data-appearance=['"]dark['"]\]\s*\{([^}]+)\}/;

const dayTokens = parseTokensBlock(tokens, DAY_SELECTOR);
const nightTokens = parseTokensBlock(tokens, NIGHT_SELECTOR);

function requireToken(tokenMap: Record<string, string>, name: string): string {
  const value = tokenMap[name];
  if (value === undefined) {
    throw new Error(`Missing expected design token: --${name}`);
  }
  return value;
}

describe('colour contrast compliance', () => {
  it('meets AA text contrast (at least 4.5:1) for label.bandText against label.band on every manifest', () => {
    const manifests = [...createRegistry().manifests, fakeManifest];
    for (const manifest of manifests) {
      expect(contrastRatio(manifest.label.bandText, manifest.label.band)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('meets UI accent contrast (at least 3:1) for accent.day and accent.night against their mode panels', () => {
    const dayPanel = requireToken(dayTokens, 'panel');
    const nightPanel = requireToken(nightTokens, 'panel');
    const manifests = [...createRegistry().manifests, fakeManifest];

    for (const manifest of manifests) {
      expect(contrastRatio(manifest.accent.day, dayPanel)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(manifest.accent.night, nightPanel)).toBeGreaterThanOrEqual(3);
    }
  });

  it('meets AA contrast (at least 4.5:1) for ink tokens against panels and accent-ink on accent in day and night modes', () => {
    const modes = [
      { name: 'day', tokens: dayTokens },
      { name: 'night', tokens: nightTokens },
    ] as const;

    for (const mode of modes) {
      const panel = requireToken(mode.tokens, 'panel');
      const panel2 = requireToken(mode.tokens, 'panel-2');
      const ink = requireToken(mode.tokens, 'ink');
      const inkSoft = requireToken(mode.tokens, 'ink-soft');
      const inkFaint = requireToken(mode.tokens, 'ink-faint');
      const accent = requireToken(mode.tokens, 'accent');
      const accentInk = requireToken(mode.tokens, 'accent-ink');

      const inkTokens = [ink, inkSoft, inkFaint];
      const surfaces = [panel, panel2];

      for (const inkColor of inkTokens) {
        for (const surface of surfaces) {
          expect(contrastRatio(inkColor, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }

      expect(contrastRatio(accentInk, accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
