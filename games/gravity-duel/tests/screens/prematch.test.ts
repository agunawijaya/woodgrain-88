// @vitest-environment happy-dom
/**
 * Tests for Gravity Duel's pre-match screen: Enter, Space and Escape wire to
 * the controller's callbacks (ignoring repeats), and solo docking draws one
 * card.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPrematchScreen } from '../../src/screens/prematch.ts';

const SEAT_0 = { main: '#ff8a2a', deep: '#b4501b' };
const SEAT_1 = { main: '#38a8ff', deep: '#1d68ad' };

function seat(name: string, colours = SEAT_0) {
  return { name, colours, switchPosition: 'B' as const, keys: 'Arrows · Enter' };
}

function pressKey(key: string, code: string, extra: Partial<KeyboardEventInit> = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, code, ...extra }));
}

describe('pre-match screen', () => {
  it('Enter or Space calls onReady, ignoring a repeat', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onReady = vi.fn();
    const screen = createPrematchScreen({
      host,
      look: 'deep',
      seats: [seat('Lance'), seat('Crescent', SEAT_1)],
      onReady,
      onBack: vi.fn(),
    });

    pressKey('Enter', 'Enter');
    expect(onReady).toHaveBeenCalledTimes(1);

    pressKey(' ', 'Space');
    expect(onReady).toHaveBeenCalledTimes(2);

    pressKey('Enter', 'Enter', { repeat: true });
    expect(onReady).toHaveBeenCalledTimes(2);

    screen.dispose();
    host.remove();
  });

  it('Escape calls onBack', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onBack = vi.fn();
    const screen = createPrematchScreen({
      host,
      look: 'deep',
      seats: [seat('Lance')],
      onReady: vi.fn(),
      onBack,
    });

    pressKey('Escape', 'Escape');
    expect(onBack).toHaveBeenCalledTimes(1);

    screen.dispose();
    host.remove();
  });

  it('draws one card for solo docking, with no vs', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const screen = createPrematchScreen({
      host,
      look: 'deep',
      seats: [seat('You')],
      onReady: vi.fn(),
      onBack: vi.fn(),
    });

    expect(host.querySelectorAll('.gd-seat-card')).toHaveLength(1);
    expect(host.querySelector('.gd-prematch')).not.toBeNull();

    screen.dispose();
    host.remove();
  });

  it('shows the ready prompt, then the count, in the same footer card', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const screen = createPrematchScreen({
      host,
      look: 'deep',
      seats: [seat('Lance'), seat('Crescent', SEAT_1)],
      onReady: vi.fn(),
      onBack: vi.fn(),
    });

    expect(host.querySelector('.gd-prompt-text')?.textContent).toBe('Press Enter or Space to fly');

    screen.setCount(3);
    expect(host.querySelector('.gd-countdown')?.textContent).toBe('3');

    screen.setCount(0);
    expect(host.querySelector('.gd-countdown')?.textContent).toBe('Go!');

    screen.setCount(null);
    expect(host.querySelector('.gd-prompt-text')).not.toBeNull();

    screen.dispose();
    host.remove();
  });
});
