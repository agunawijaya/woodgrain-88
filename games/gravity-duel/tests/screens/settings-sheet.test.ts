// @vitest-environment happy-dom
/**
 * Tests for Gravity Duel's settings sheet: the trajectory guide is disabled,
 * with its reason shown, in Daily, challenge and micro-challenge runs, and
 * Follow is offered only to a lone player.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GameSettingsStore } from '@woodgrain-88/kit';
import { createGravitySettings } from '../../src/app/settings.ts';
import { createSettingsSheet } from '../../src/screens/settings-sheet.ts';

function createMemoryStore(): GameSettingsStore {
  const map = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T): T {
      return map.has(key) ? (map.get(key) as T) : fallback;
    },
    set(key: string, value: unknown): void {
      map.set(key, value);
    },
  };
}

describe('settings sheet', () => {
  it('disables the trajectory guide and shows why, when the run forces it off', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const settings = createGravitySettings(createMemoryStore());
    const sheet = createSettingsSheet({
      host,
      settings,
      guideForced: true,
      followAvailable: true,
      onAllSettings: vi.fn(),
      onClose: vi.fn(),
    });

    const guideButtons = host.querySelectorAll<HTMLButtonElement>(
      '[role="radiogroup"][aria-label="Trajectory guide"] button',
    );
    expect(Array.from(guideButtons).every((button) => button.disabled)).toBe(true);
    expect(host.textContent).toContain(
      'Daily, challenge and record runs are flown without the guide.',
    );

    sheet.dispose();
    host.remove();
  });

  it('leaves the guide switchable, with no reason shown, in ordinary play', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const settings = createGravitySettings(createMemoryStore());
    const sheet = createSettingsSheet({
      host,
      settings,
      guideForced: false,
      followAvailable: true,
      onAllSettings: vi.fn(),
      onClose: vi.fn(),
    });

    const guideButtons = host.querySelectorAll<HTMLButtonElement>(
      '[role="radiogroup"][aria-label="Trajectory guide"] button',
    );
    expect(Array.from(guideButtons).some((button) => button.disabled)).toBe(false);
    expect(host.textContent).not.toContain(
      'Daily, challenge and record runs are flown without the guide.',
    );

    sheet.dispose();
    host.remove();
  });

  it('disables Follow, with a reason, when there is no lone player', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const settings = createGravitySettings(createMemoryStore());
    const sheet = createSettingsSheet({
      host,
      settings,
      guideForced: false,
      followAvailable: false,
      onAllSettings: vi.fn(),
      onClose: vi.fn(),
    });

    const cameraButtons = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button[role="radio"]'),
    ).filter((button) => button.textContent === 'Overhead' || button.textContent === 'Follow');
    expect(cameraButtons.every((button) => button.disabled)).toBe(true);
    expect(host.textContent).toContain('Follow is offered only to a lone player.');

    sheet.dispose();
    host.remove();
  });
});
