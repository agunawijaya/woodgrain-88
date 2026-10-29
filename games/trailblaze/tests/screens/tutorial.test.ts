// @vitest-environment happy-dom
/**
 * Tests for Trailblaze tutorial: six cards stepping forward and backward
 * with keyboard and buttons, and onDone callback triggering on completion or skip.
 */
import { describe, expect, it, vi } from 'vitest';
import { createTutorialScreen } from '../../src/screens/tutorial.ts';

describe('tutorial screen', () => {
  it('steps through all six cards with buttons and keyboard, calling onDone', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onDone = vi.fn();
    const tutorial = createTutorialScreen({
      host,
      onDone,
    });

    const titleEl = () => host.querySelector('.tb-tutorial-title')?.textContent;
    const copyEl = () => host.querySelector('.tb-tutorial-copy')?.textContent;
    const nextBtn = () => host.querySelector<HTMLButtonElement>('[data-action="next"]');
    const prevBtn = () => host.querySelector<HTMLButtonElement>('[data-action="prev"]');

    // Card 1
    expect(titleEl()).toBe('Constant Motion');
    expect(copyEl()).toContain('You never stop');
    expect(prevBtn()?.hasAttribute('disabled')).toBe(true);

    // Card 2
    nextBtn()?.click();
    expect(titleEl()).toBe('Steering');
    expect(copyEl()).toContain('Steer with WASD');

    // Back to Card 1 with ArrowLeft
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(titleEl()).toBe('Constant Motion');

    // Forward with ArrowRight
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(titleEl()).toBe('Steering');

    // Card 3 with Enter
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(titleEl()).toBe('Trails Become Walls');
    expect(copyEl()).toContain('Every cell you leave becomes a wall');

    // Card 4
    nextBtn()?.click();
    expect(titleEl()).toBe('Boxing In');
    expect(copyEl()).toContain('Box your rival in');

    // Card 5
    nextBtn()?.click();
    expect(titleEl()).toBe('Speed-Up');
    expect(copyEl()).toContain('On speed-up channels the pace climbs');

    // Card 6
    nextBtn()?.click();
    expect(titleEl()).toBe('Gaps & Wraparound');
    expect(copyEl()).toContain('Gaps: hold fire to leave holes');
    expect(nextBtn()?.textContent).toContain('Done');

    // Finishing on Card 6
    expect(onDone).not.toHaveBeenCalled();
    nextBtn()?.click();
    expect(onDone).toHaveBeenCalledTimes(1);

    tutorial.dispose();
    host.remove();
  });

  it('triggers onDone on skip button click', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onDone = vi.fn();
    const tutorial = createTutorialScreen({
      host,
      onDone,
    });

    const skipBtn = host.querySelector<HTMLButtonElement>('[data-action="skip"]');
    skipBtn?.click();
    expect(onDone).toHaveBeenCalledTimes(1);

    tutorial.dispose();
    host.remove();
  });
});
