// @vitest-environment happy-dom
/**
 * Tests for Gravity Duel's HUD: it reads the match and reflects fuel and
 * ammo bars in a duel, dock counts in docking, and the clock, blinking for
 * its last 1,024 ticks.
 */
import { describe, expect, it } from 'vitest';
import { setupFor } from '../helpers.ts';
import { CLOCK_WARNING_TICKS } from '../../src/engine/types.ts';
import { createHud } from '../../src/ui/hud.ts';

const COLOURS = {
  0: { main: '#ff8a2a', deep: '#b4501b' },
  1: { main: '#38a8ff', deep: '#1d68ad' },
} as const;

describe('HUD', () => {
  it('shows fuel and ammo segments in a duel, and hides the dock count', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const hud = createHud({
      host,
      look: 'deep',
      seats: [
        { name: 'Lance', colours: COLOURS[0] },
        { name: 'Crescent', colours: COLOURS[1] },
      ],
      appearance: 'light',
    });

    const match = setupFor(1);
    hud.update(match);

    const blocks = host.querySelectorAll('.gd-hud-seat');
    expect(blocks).toHaveLength(2);
    expect(host.querySelectorAll('.gd-hud-bar')).toHaveLength(4); // fuel + ammo, two seats
    expect(host.querySelector<HTMLElement>('.gd-hud-docks')?.hidden).toBe(true);

    hud.dispose();
    host.remove();
  });

  it('shows dock counts instead of bars in docking', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const hud = createHud({
      host,
      look: 'deep',
      seats: [
        { name: 'Lance', colours: COLOURS[0] },
        { name: 'Crescent', colours: COLOURS[1] },
      ],
      appearance: 'light',
    });

    const match = setupFor(8);
    match.ships[0].score = 3;
    hud.update(match);

    const docks = host.querySelector<HTMLElement>('.gd-hud-docks');
    expect(docks?.hidden).toBe(false);
    expect(docks?.textContent).toBe('3 docks');

    hud.dispose();
    host.remove();
  });

  it("blinks the clock for the match's last 1,024 ticks", () => {
    const host = document.createElement('div');
    document.body.append(host);
    const hud = createHud({
      host,
      look: 'deep',
      seats: [
        { name: 'Lance', colours: COLOURS[0] },
        { name: 'Crescent', colours: COLOURS[1] },
      ],
      appearance: 'light',
    });

    const match = setupFor(1);
    hud.update(match);
    expect(host.querySelector('.gd-hud-clock')?.classList.contains('is-blinking')).toBe(false);

    match.clockLeft = CLOCK_WARNING_TICKS;
    hud.update(match);
    expect(host.querySelector('.gd-hud-clock')?.classList.contains('is-blinking')).toBe(true);

    hud.dispose();
    host.remove();
  });
});
