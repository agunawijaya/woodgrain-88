// @vitest-environment happy-dom
/**
 * Tests for Trailblaze results screen: action button order and R/H hotkeys,
 * "How Rosa saw it" replay panel visibility, four canvas frames, and mark icons.
 */
import { describe, expect, it, vi } from 'vitest';
import { createResultsScreen, type KidReplayFrame } from '../../src/screens/results.ts';

function createDummyFrame(
  atMs: number,
  marks: readonly ('slipped-late' | 'slipped-wrong' | 'missed')[] = [],
): KidReplayFrame {
  const cells = new Int8Array(800);
  return {
    atMs,
    cells,
    kidHead: 410,
    awareness: 3,
    marks,
  };
}

describe('results screen', () => {
  it('renders action buttons in strict order and handles R and H keys', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onPlayAgain = vi.fn();
    const onGameMenu = vi.fn();
    const onBackToHall = vi.fn();

    const results = createResultsScreen({
      host,
      seats: [
        {
          name: 'You',
          score: 10,
          cellsClaimed: 120,
          trapsSprung: 2,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Computer 1977',
          score: 6,
          cellsClaimed: 95,
          trapsSprung: 0,
          colours: { main: '#38a8ff', deep: '#1d68ad' },
          isHuman: false,
        },
      ],
      winner: 0,
      longestRideSeconds: 14.2,
      onPlayAgain,
      onGameMenu,
      onBackToHall,
      shareLine: 'Trailblaze CH 01 · 10–6 against Computer 1977',
    });

    const actionButtons = host.querySelectorAll<HTMLButtonElement>('.tb-actions button');
    expect(actionButtons).toHaveLength(3);
    expect(actionButtons[0]?.textContent).toContain('Play again');
    expect(actionButtons[0]?.textContent).toContain('R');
    expect(actionButtons[1]?.textContent).toContain('Game menu');
    expect(actionButtons[2]?.textContent).toContain('Back to the Hall');
    expect(actionButtons[2]?.textContent).toContain('H');

    // Winner text
    expect(host.querySelector('.tb-banner')?.textContent).toContain('You win');
    expect(host.querySelector('.tb-banner')?.textContent).toContain('You win 10–6');

    // Keyboard shortcuts
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
    expect(onBackToHall).toHaveBeenCalledTimes(1);

    results.dispose();
    host.remove();
  });

  it('hides "How Rosa saw it" for non-Kid opponents', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const results = createResultsScreen({
      host,
      seats: [
        {
          name: 'Player 1',
          score: 10,
          cellsClaimed: 110,
          trapsSprung: 1,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Player 2',
          score: 8,
          cellsClaimed: 105,
          trapsSprung: 1,
          colours: { main: '#38a8ff', deep: '#1d68ad' },
          isHuman: true,
        },
      ],
      versus: true,
      winner: 0,
      longestRideSeconds: 12.0,
      onPlayAgain: () => undefined,
      onGameMenu: () => undefined,
      onBackToHall: () => undefined,
    });

    expect(host.querySelector('.tb-replay')).toBeNull();

    results.dispose();
    host.remove();
  });

  it('renders "How Rosa saw it" collapsed by default for a Kid with four frames and marks', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const replayFrames: KidReplayFrame[] = [
      createDummyFrame(1500, ['slipped-late']),
      createDummyFrame(1000, ['missed']),
      createDummyFrame(500, ['slipped-wrong']),
      createDummyFrame(0, []),
    ];

    const results = createResultsScreen({
      host,
      seats: [
        {
          name: 'You',
          score: 10,
          cellsClaimed: 140,
          trapsSprung: 3,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Rosa',
          score: 8,
          cellsClaimed: 120,
          trapsSprung: 1,
          colours: { main: '#38a8ff', deep: '#1d68ad' },
          isHuman: false,
        },
      ],
      winner: 0,
      longestRideSeconds: 15.5,
      kid: {
        id: 'rosa',
        name: 'Rosa',
        replayFrames,
      },
      onPlayAgain: () => undefined,
      onGameMenu: () => undefined,
      onBackToHall: () => undefined,
    });

    const replayDetails = host.querySelector<HTMLDetailsElement>('.tb-replay');
    expect(replayDetails).not.toBeNull();
    expect(replayDetails?.open).toBe(false);
    expect(replayDetails?.querySelector('summary')?.textContent).toContain('How Rosa saw it');

    const frames = host.querySelectorAll('.tb-replay-frame');
    expect(frames).toHaveLength(4);

    expect(frames[0]?.textContent).toContain('1.5s before');
    expect(frames[1]?.textContent).toContain('1.0s before');
    expect(frames[2]?.textContent).toContain('0.5s before');
    expect(frames[3]?.textContent).toContain('Crash');

    // Check mark icons rendered
    const markIcons = host.querySelectorAll('.tb-frame-marks .tb-mark-icon');
    expect(markIcons.length).toBeGreaterThanOrEqual(3);

    // Legend is present
    expect(host.querySelector('.tb-replay-legend')?.textContent).toContain('Slipped late');
    expect(host.querySelector('.tb-replay-legend')?.textContent).toContain('Slipped wrong');
    expect(host.querySelector('.tb-replay-legend')?.textContent).toContain('Missed rival turn');

    results.dispose();
    host.remove();
  });
});
