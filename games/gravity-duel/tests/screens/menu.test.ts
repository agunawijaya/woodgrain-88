// @vitest-environment happy-dom
/**
 * Tests for Gravity Duel's menu screen: the mode tabs filter the channel
 * dial to that group's channels, a locked Remix channel shows the patch that
 * opens it, and the opponent picker ("Pick your rival") hides in solo
 * docking, where there is no rival to choose.
 */
import { describe, expect, it, vi } from 'vitest';
import { createMenuScreen } from '../../src/screens/menu.ts';

function baseOptions(host: HTMLElement) {
  return {
    host,
    mode: 'duel' as const,
    channelId: 'game-1',
    opponent: 'rosa' as const,
    look: 'deep' as const,
    scheme: 'classic' as const,
    matchLength: 10 as const,
    switches: ['B', 'B'] as const,
    isUnlocked: () => true,
    onMode: vi.fn(),
    onChannel: vi.fn(),
    onOpponent: vi.fn(),
    onLook: vi.fn(),
    onScheme: vi.fn(),
    onMatchLength: vi.fn(),
    onStart: vi.fn(),
    onHowToPlay: vi.fn(),
    onSettings: vi.fn(),
    onRecords: vi.fn(),
    onBackToHall: vi.fn(),
  };
}

describe('menu screen', () => {
  it('the dial shows only the channels of the selected mode', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const options = baseOptions(host);
    const menu = createMenuScreen(options);

    // Duel: the seven cartridge duels plus the four Remix channels (all duels).
    expect(host.querySelectorAll('.gd-dial-item')).toHaveLength(11);

    const raceTab = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-mode]')).find(
      (button) => button.dataset.mode === 'race',
    );
    raceTab?.click();
    expect(options.onMode).toHaveBeenCalledWith('race');
    expect(host.querySelectorAll('.gd-dial-item')).toHaveLength(6);

    const soloTab = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-mode]')).find(
      (button) => button.dataset.mode === 'solo',
    );
    soloTab?.click();
    expect(options.onMode).toHaveBeenCalledWith('solo');
    expect(host.querySelectorAll('.gd-dial-item')).toHaveLength(4);

    menu.dispose();
    host.remove();
  });

  it('a locked Remix channel is disabled and names the patch that opens it', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const options = {
      ...baseOptions(host),
      channelId: 'binary-stars',
      isUnlocked: (id: string) => id !== 'binary-stars',
    };
    const menu = createMenuScreen(options);

    const locked = host.querySelector<HTMLButtonElement>('.gd-dial-item.is-locked');
    expect(locked).not.toBeNull();
    expect(locked?.textContent).toContain('🔒');

    const startButton = host.querySelector<HTMLButtonElement>('.gd-modes button[disabled]');
    expect(startButton).not.toBeNull();
    expect(startButton?.textContent).toContain("Lou's Orbit");
    startButton?.click();
    expect(options.onStart).not.toHaveBeenCalled();

    menu.dispose();
    host.remove();
  });

  it('hides the opponent picker in solo docking, where there is no rival', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const menu = createMenuScreen({ ...baseOptions(host), mode: 'solo', channelId: 'game-14' });

    const rivals = host.querySelector<HTMLElement>('.gd-rivals');
    expect(rivals?.hidden).toBe(true);
    expect(host.querySelector('[data-start="solo"]')).not.toBeNull();
    expect(host.querySelector('[data-start="kid"]')).toBeNull();

    menu.dispose();
    host.remove();
  });

  it('starts a Kid match or a friend match from the two duel buttons', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const options = baseOptions(host);
    const menu = createMenuScreen(options);

    host.querySelector<HTMLButtonElement>('[data-start="kid"]')?.click();
    expect(options.onStart).toHaveBeenCalledWith(false);

    host.querySelector<HTMLButtonElement>('[data-start="friend"]')?.click();
    expect(options.onStart).toHaveBeenCalledWith(true);

    menu.dispose();
    host.remove();
  });

  it('show() focuses the primary start button on the next animation frame', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const menu = createMenuScreen(baseOptions(host));

    menu.show();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(document.activeElement).toBe(host.querySelector('.gd-modes .is-primary'));

    menu.dispose();
    host.remove();
  });
});
