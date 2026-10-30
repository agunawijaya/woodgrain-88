// @vitest-environment happy-dom
/**
 * Tests for Gravity Duel's results screen: the winner banner or solo docks,
 * the share line, per-seat stats in order, patches, R and H on the keyboard,
 * one score card and one stats column in solo, and the Kid replay panel's
 * frames (collapsed by default, latest moment's data shown).
 */
import { describe, expect, it, vi } from 'vitest';
import { createResultsScreen } from '../../src/screens/results.ts';

const SEAT_0 = { main: '#ff8a2a', deep: '#b4501b' };
const SEAT_1 = { main: '#38a8ff', deep: '#1d68ad' };

function seat(
  name: string,
  overrides: Partial<Parameters<typeof createResultsScreen>[0]['seats'][number]> = {},
) {
  return {
    name,
    score: 0,
    shots: 0,
    hits: 0,
    fuelUsed: 0,
    docks: 0,
    starCrashes: 0,
    colours: SEAT_0,
    ...overrides,
  };
}

function baseOptions(host: HTMLElement) {
  return {
    host,
    versus: true,
    seats: [seat('Lance'), seat('Crescent')] as const,
    winner: 0 as const,
    showCombatStats: true,
    showStarCrashes: false,
    showDocks: false,
    patchesEarned: [],
    onPlayAgain: vi.fn(),
    onGameMenu: vi.fn(),
    onBackToHall: vi.fn(),
  };
}

function pressKey(code: string, extra: Partial<KeyboardEventInit> = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, ...extra }));
}

describe('results screen', () => {
  it('shows the winner by name and score in a versus match', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen({
      ...baseOptions(host),
      seats: [seat('Lance', { score: 10 }), seat('Crescent', { score: 6, colours: SEAT_1 })],
      winner: 0,
    });

    expect(host.querySelector('.gd-banner h2')?.textContent).toBe('Lance wins');
    expect(host.querySelector('.gd-banner p')?.textContent).toBe('Lance wins 10–6');

    results.dispose();
    host.remove();
  });

  it('calls a level match a draw and gives the score it ended on', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen({
      ...baseOptions(host),
      seats: [seat('Lance', { score: 4 }), seat('Crescent', { score: 4, colours: SEAT_1 })],
      winner: null,
    });

    expect(host.querySelector('.gd-banner h2')?.textContent).toBe('A draw');
    expect(host.querySelector('.gd-banner p')?.textContent).toBe('A draw at 4–4');

    results.dispose();
    host.remove();
  });

  it('shows docks and the time, not a winner, for solo docking', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen({
      host,
      versus: false,
      seats: [seat('You', { score: 7, docks: 7 })],
      winner: null,
      soloDocks: 7,
      durationMs: 95000,
      showCombatStats: false,
      showStarCrashes: false,
      showDocks: true,
      patchesEarned: [],
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });

    expect(host.querySelector('.gd-banner h2')?.textContent).toBe('7 docks');
    expect(host.querySelector('.gd-banner p')?.textContent).toBe('In 1:35');
    expect(host.querySelectorAll('.gd-score-card')).toHaveLength(1);
    // One stats column: the header row has just the one seat's name.
    expect(host.querySelectorAll('.gd-facts-table thead th')).toHaveLength(1);

    results.dispose();
    host.remove();
  });

  it('shows the share line and its Copy button when sharing is offered', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onShare = vi.fn();
    const results = createResultsScreen({
      ...baseOptions(host),
      shareLine: 'Gravity Duel · 🟦🟦🟥🟦 · 3–1',
      onShare,
    });

    expect(host.querySelector('.gd-share-line')?.textContent).toBe('Gravity Duel · 🟦🟦🟥🟦 · 3–1');
    host.querySelector<HTMLButtonElement>('[data-action="share"]')?.click();
    expect(onShare).toHaveBeenCalledTimes(1);

    results.dispose();
    host.remove();
  });

  it('leaves out combat stats, star crashes and docks when they do not apply', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen(baseOptions(host));

    const rowLabels = Array.from(host.querySelectorAll('.gd-facts-table th[scope="row"]')).map(
      (row) => row.textContent,
    );
    expect(rowLabels).toContain('Shots');
    expect(rowLabels).not.toContain('Star crashes');
    expect(rowLabels).not.toContain('Docks');

    results.dispose();
    host.remove();
  });

  it('shows star crashes and docks when the controller says they apply', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen({
      ...baseOptions(host),
      showCombatStats: false,
      showStarCrashes: true,
      showDocks: true,
    });

    const rowLabels = Array.from(host.querySelectorAll('.gd-facts-table th[scope="row"]')).map(
      (row) => row.textContent,
    );
    expect(rowLabels).not.toContain('Shots');
    expect(rowLabels).toContain('Star crashes');
    expect(rowLabels).toContain('Docks');

    results.dispose();
    host.remove();
  });

  it('R plays again and H goes back to the Hall, ignoring repeats and modified keys', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const options = baseOptions(host);
    const results = createResultsScreen(options);

    pressKey('KeyR', { repeat: true });
    expect(options.onPlayAgain).not.toHaveBeenCalled();

    pressKey('KeyH', { ctrlKey: true });
    expect(options.onBackToHall).not.toHaveBeenCalled();

    pressKey('KeyR');
    expect(options.onPlayAgain).toHaveBeenCalledTimes(1);

    pressKey('KeyH');
    expect(options.onBackToHall).toHaveBeenCalledTimes(1);

    results.dispose();
    host.remove();
  });

  it('focuses the Play again button once shown', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen(baseOptions(host));

    expect(document.activeElement).toBe(host.querySelector('[data-action="play-again"]'));

    results.dispose();
    host.remove();
  });

  it("shows How the Kid flew it, collapsed by default, with the latest moment's frames", () => {
    const host = document.createElement('div');
    document.body.append(host);
    const results = createResultsScreen({
      ...baseOptions(host),
      kid: {
        id: 'rosa',
        name: 'Rosa',
        frames: [
          {
            beforeMs: 1000,
            ships: [{ x: 0, z: 0, heading: 0 }],
            missiles: [],
            aimHeading: 0.5,
            believedFuel: 3,
            trueFuel: 2,
          },
        ],
      },
    });

    const details = host.querySelector<HTMLDetailsElement>('.gd-kid-replay');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('How Rosa flew it');
    expect(host.querySelectorAll('.gd-kid-frame')).toHaveLength(1);
    expect(host.querySelector('.gd-kid-frame-caption')?.textContent).toContain(
      'thought 3 left (really 2)',
    );

    results.dispose();
    host.remove();
  });
});
