// @vitest-environment happy-dom
/**
 * Tests for Trailblaze results screen: action button order and R/H hotkeys,
 * facts table with cells laid and traps sprung per rider, HTML escaping,
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
          cellsLaid: 120,
          trapsSprung: 2,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Computer 1977',
          score: 6,
          cellsLaid: 95,
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
          cellsLaid: 110,
          trapsSprung: 1,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Player 2',
          score: 8,
          cellsLaid: 105,
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
          cellsLaid: 140,
          trapsSprung: 3,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Rosa',
          score: 8,
          cellsLaid: 120,
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

  it('renders facts table with per-seat columns in order, cells laid, traps sprung, and longest ride', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const results = createResultsScreen({
      host,
      seats: [
        {
          name: 'You',
          score: 10,
          cellsLaid: 63,
          trapsSprung: 1,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Moss',
          score: 8,
          cellsLaid: 58,
          trapsSprung: 0,
          colours: { main: '#38a8ff', deep: '#1d68ad' },
          isHuman: false,
        },
      ],
      winner: 0,
      longestRideSeconds: 12.43,
      onPlayAgain: () => undefined,
      onGameMenu: () => undefined,
      onBackToHall: () => undefined,
    });

    // The longest ride reads 12.4 s for 12.43
    const longest = host.querySelector('.tb-facts-longest strong');
    expect(longest?.textContent).toBe('12.4 s');

    // Column headers per seat in seat order with seat names and seat colours
    const headers = host.querySelectorAll<HTMLTableCellElement>('.tb-facts-table thead th');
    expect(headers).toHaveLength(2);
    expect(headers[0]?.textContent).toBe('You');
    expect(headers[0]?.getAttribute('style')).toContain('--seat: #ff8a2a');
    expect(headers[1]?.textContent).toBe('Moss');
    expect(headers[1]?.getAttribute('style')).toContain('--seat: #38a8ff');

    // Each "Cells laid" cell holds that seat's own number
    const rows = host.querySelectorAll('.tb-facts-table tbody tr');
    expect(rows).toHaveLength(2);

    const cellsLaidRow = rows[0];
    expect(cellsLaidRow?.querySelector('th')?.textContent).toBe('Cells laid');
    const cellsLaidValues = cellsLaidRow?.querySelectorAll('td');
    expect(cellsLaidValues).toHaveLength(2);
    expect(cellsLaidValues?.[0]?.textContent).toBe('63');
    expect(cellsLaidValues?.[1]?.textContent).toBe('58');

    // "Traps sprung" likewise
    const trapsSprungRow = rows[1];
    expect(trapsSprungRow?.querySelector('th')?.textContent).toBe('Traps sprung');
    const trapsSprungValues = trapsSprungRow?.querySelectorAll('td');
    expect(trapsSprungValues).toHaveLength(2);
    expect(trapsSprungValues?.[0]?.textContent).toBe('1');
    expect(trapsSprungValues?.[1]?.textContent).toBe('0');

    results.dispose();
    host.remove();
  });

  it('renders four columns for four seats', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const results = createResultsScreen({
      host,
      seats: [
        {
          name: 'Player 1',
          score: 10,
          cellsLaid: 50,
          trapsSprung: 2,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
        {
          name: 'Rosa',
          score: 8,
          cellsLaid: 45,
          trapsSprung: 1,
          colours: { main: '#38a8ff', deep: '#1d68ad' },
          isHuman: false,
        },
        {
          name: 'Moss',
          score: 6,
          cellsLaid: 40,
          trapsSprung: 0,
          colours: { main: '#44d62c', deep: '#2a881b' },
          isHuman: false,
        },
        {
          name: 'Dee',
          score: 4,
          cellsLaid: 35,
          trapsSprung: 0,
          colours: { main: '#e040fb', deep: '#8e24aa' },
          isHuman: false,
        },
      ],
      winner: 0,
      longestRideSeconds: 10.0,
      onPlayAgain: () => undefined,
      onGameMenu: () => undefined,
      onBackToHall: () => undefined,
    });

    const headers = host.querySelectorAll<HTMLTableCellElement>('.tb-facts-table thead th');
    expect(headers).toHaveLength(4);
    expect(Array.from(headers).map((h) => h.textContent)).toEqual([
      'Player 1',
      'Rosa',
      'Moss',
      'Dee',
    ]);

    const cellsRowTds = host.querySelectorAll('.tb-facts-table tbody tr:first-child td');
    expect(cellsRowTds).toHaveLength(4);
    expect(Array.from(cellsRowTds).map((td) => td.textContent)).toEqual(['50', '45', '40', '35']);

    const trapsRowTds = host.querySelectorAll('.tb-facts-table tbody tr:last-child td');
    expect(trapsRowTds).toHaveLength(4);
    expect(Array.from(trapsRowTds).map((td) => td.textContent)).toEqual(['2', '1', '0', '0']);

    results.dispose();
    host.remove();
  });

  it('escapes seat names with < in the table header', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const results = createResultsScreen({
      host,
      seats: [
        {
          name: '<Speedster>',
          score: 10,
          cellsLaid: 70,
          trapsSprung: 1,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          isHuman: true,
        },
      ],
      winner: 0,
      longestRideSeconds: 8.5,
      onPlayAgain: () => undefined,
      onGameMenu: () => undefined,
      onBackToHall: () => undefined,
    });

    const header = host.querySelector<HTMLTableCellElement>('.tb-facts-table thead th');
    expect(header?.textContent).toBe('<Speedster>');
    expect(header?.innerHTML).toBe('&lt;Speedster&gt;');

    results.dispose();
    host.remove();
  });
});
