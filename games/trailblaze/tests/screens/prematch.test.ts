// @vitest-environment happy-dom
/**
 * Tests for Trailblaze pre-match screen: lineup cards with seat identities,
 * colour and trail swatches, keys note, look name, countdown, and keyboard readiness.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPrematchScreen } from '../../src/screens/prematch.ts';

describe('pre-match screen', () => {
  it('renders lineup cards with look name, seat information and keys', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onReady = vi.fn();
    const onBack = vi.fn();

    const screen = createPrematchScreen({
      host,
      look: 'neon',
      seats: [
        {
          name: 'You',
          role: 'you',
          seatIndex: 0,
          colours: { main: '#ff8a2a', deep: '#b4501b' },
          switchPosition: 'B',
          keys: 'WASD · Space',
        },
        {
          name: 'Rosa',
          role: 'kid',
          kid: 'rosa',
          seatIndex: 1,
          colours: { main: '#38a8ff', deep: '#1d68ad' },
          switchPosition: 'B',
          keys: 'Arrows · Enter',
        },
      ],
      onReady,
      onBack,
    });

    expect(host.querySelector('.tb-prematch-look')?.textContent).toBe('Neon Grid');

    const cards = host.querySelectorAll('.tb-seat-card');
    expect(cards).toHaveLength(2);

    expect(cards[0]?.textContent).toContain('You');
    expect(cards[0]?.textContent).toContain('Switch B');
    expect(cards[0]?.textContent).toContain('WASD · Space');

    expect(cards[1]?.textContent).toContain('Rosa');
    expect(cards[1]?.textContent).toContain('Switch B');
    expect(cards[1]?.textContent).toContain('Arrows · Enter');

    // Prompt before countdown
    expect(host.querySelector('.tb-prompt-text')?.textContent).toBe('Press Enter or Space to ride');

    // Ready on Enter or Space
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onReady).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(onReady).toHaveBeenCalledTimes(2);

    // Back on Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    // Countdown updates
    screen.setCount(3);
    expect(host.querySelector('.tb-countdown')?.textContent).toBe('3');

    screen.setCount(1);
    expect(host.querySelector('.tb-countdown')?.textContent).toBe('1');

    screen.dispose();
    host.remove();
  });
});
