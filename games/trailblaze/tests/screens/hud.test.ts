// @vitest-environment happy-dom
/**
 * Tests for Trailblaze HUD: shape marks per seat (circle, diamond, square, triangle),
 * 5-pip speed indicator and aria-label updates, queued heading arrows, pause button, and messages.
 */
import { describe, expect, it } from 'vitest';
import { createHud } from '../../src/ui/hud.ts';

describe('HUD', () => {
  it('renders tallies with shape marks for each seat', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const hud = createHud({
      host,
      seats: [
        { name: 'Rider 1', colours: { main: '#ff8a2a', deep: '#b4501b' }, isHuman: true },
        { name: 'Rider 2', colours: { main: '#38a8ff', deep: '#1d68ad' }, isHuman: false },
        { name: 'Rider 3', colours: { main: '#2ec4b6', deep: '#0f8b8d' }, isHuman: false },
        { name: 'Rider 4', colours: { main: '#ff5964', deep: '#d62246' }, isHuman: false },
      ],
    });

    const tallies = host.querySelectorAll('.tb-tally');
    expect(tallies).toHaveLength(4);

    // Seat 0: Circle
    expect(tallies[0]?.querySelector('circle')).not.toBeNull();
    // Seat 1: Diamond (polygon with 4 points)
    expect(tallies[1]?.querySelector('polygon')).not.toBeNull();
    // Seat 2: Square (rect)
    expect(tallies[2]?.querySelector('rect')).not.toBeNull();
    // Seat 3: Triangle (polygon)
    expect(tallies[3]?.querySelector('polygon')).not.toBeNull();

    hud.update([3, 5, 2, 1]);
    const scoreNums = host.querySelectorAll('.tb-score-num');
    expect(scoreNums[0]?.textContent).toBe('3');
    expect(scoreNums[1]?.textContent).toBe('5');
    expect(scoreNums[2]?.textContent).toBe('2');
    expect(scoreNums[3]?.textContent).toBe('1');

    hud.dispose();
    host.remove();
  });

  it('updates speed pips and aria label', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const hud = createHud({
      host,
      seats: [
        { name: 'Rider 1', colours: { main: '#ff8a2a', deep: '#b4501b' } },
        { name: 'Rider 2', colours: { main: '#38a8ff', deep: '#1d68ad' } },
      ],
    });

    const speedIndicator = host.querySelector('.tb-speed-indicator');
    expect(speedIndicator?.getAttribute('aria-label')).toBe('Speed 1 of 5');

    hud.setSpeedStage(2); // Stage 2 is speed 3 of 5
    expect(speedIndicator?.getAttribute('aria-label')).toBe('Speed 3 of 5');

    const filledPips = host.querySelectorAll('.tb-speed-pip.is-filled');
    expect(filledPips).toHaveLength(3);

    hud.setSpeedStage(4); // Top speed 5 of 5
    expect(speedIndicator?.getAttribute('aria-label')).toBe('Speed 5 of 5');
    expect(host.querySelectorAll('.tb-speed-pip.is-filled')).toHaveLength(5);

    hud.dispose();
    host.remove();
  });

  it('shows and clears queued turn arrows', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const hud = createHud({
      host,
      seats: [
        { name: 'Rider 1', colours: { main: '#ff8a2a', deep: '#b4501b' }, isHuman: true },
        { name: 'Rider 2', colours: { main: '#38a8ff', deep: '#1d68ad' }, isHuman: true },
      ],
    });

    const arrows = host.querySelectorAll('.tb-queued-arrow');
    expect(arrows[0]?.textContent).toBe('');

    hud.setQueuedTurn(0, 'up');
    expect(arrows[0]?.textContent).toBe('↑');

    hud.setQueuedTurn(1, 'down-right');
    expect(arrows[1]?.textContent).toBe('↘');

    hud.setQueuedTurn(0, null);
    expect(arrows[0]?.textContent).toBe('');

    hud.dispose();
    host.remove();
  });
});
