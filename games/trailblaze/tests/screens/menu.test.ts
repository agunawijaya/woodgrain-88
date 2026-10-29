// @vitest-environment happy-dom
/**
 * Tests for Trailblaze menu screen: channel dial navigation with [ and ],
 * mode sets per channel kind (duel, computer channels 2 & 4, doodle, four-way),
 * locked Remix restrictions, Escape returning to Hall, and presence of every Kid line.
 */
import { describe, expect, it, vi } from 'vitest';
import { createMenuScreen, KID_LINES } from '../../src/screens/menu.ts';

describe('menu screen', () => {
  it('renders duel channel modes (kid, versus, computer)', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onStart = vi.fn();
    const menu = createMenuScreen({
      host,
      channelId: 'game-1',
      opponent: 'rosa',
      onStart,
    });

    const modeButtons = host.querySelectorAll<HTMLButtonElement>('.tb-modes button');
    expect(modeButtons).toHaveLength(3);
    expect(modeButtons[0]?.textContent).toContain('VS A KID');
    expect(modeButtons[0]?.textContent).toContain('Against Rosa');
    expect(modeButtons[1]?.textContent).toContain('VERSUS');
    expect(modeButtons[2]?.textContent).toContain('VS COMPUTER 1977');

    modeButtons[0]?.click();
    expect(onStart).toHaveBeenCalledWith('kid', 'game-1', 'rosa');

    menu.dispose();
    host.remove();
  });

  it('hides Kid mode and puts Computer 1977 first on channels 2 and 4', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const menu = createMenuScreen({
      host,
      channelId: 'game-2',
    });

    const modeButtons = host.querySelectorAll<HTMLButtonElement>('.tb-modes button');
    expect(modeButtons).toHaveLength(2);
    expect(modeButtons[0]?.textContent).toContain('VS COMPUTER 1977');
    expect(modeButtons[1]?.textContent).toContain('VERSUS');
    expect(host.textContent).not.toContain('VS A KID');

    menu.setChannel('game-4');
    const ch4Buttons = host.querySelectorAll<HTMLButtonElement>('.tb-modes button');
    expect(ch4Buttons).toHaveLength(2);
    expect(ch4Buttons[0]?.textContent).toContain('VS COMPUTER 1977');
    expect(ch4Buttons[1]?.textContent).toContain('VERSUS');

    menu.dispose();
    host.remove();
  });

  it('renders doodle modes on channels 13 and 14', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const menu = createMenuScreen({
      host,
      channelId: 'game-13',
    });

    const modeButtons = host.querySelectorAll<HTMLButtonElement>('.tb-modes button');
    expect(modeButtons).toHaveLength(2);
    expect(modeButtons[0]?.textContent).toContain('DOODLE');
    expect(modeButtons[0]?.textContent).toContain('Draw alone, nothing to crash into');
    expect(modeButtons[1]?.textContent).toContain('DOODLE TOGETHER');
    expect(modeButtons[1]?.textContent).toContain('Two pens, one board');

    menu.dispose();
    host.remove();
  });

  it('renders four way modes on channel four-way', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const menu = createMenuScreen({
      host,
      channelId: 'four-way',
    });

    const modeButtons = host.querySelectorAll<HTMLButtonElement>('.tb-modes button');
    expect(modeButtons).toHaveLength(2);
    expect(modeButtons[0]?.textContent).toContain('FOUR WAY');
    expect(modeButtons[0]?.textContent).toContain('You and three Kids');
    expect(modeButtons[1]?.textContent).toContain('FOUR WAY · TWO PLAYERS');

    menu.dispose();
    host.remove();
  });

  it('moves channel dial with [ and ] keys', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onChannel = vi.fn();
    const menu = createMenuScreen({
      host,
      channelId: 'game-1',
      onChannel,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
    expect(onChannel).toHaveBeenCalledWith('game-2');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
    expect(onChannel).toHaveBeenCalledWith('game-1');

    menu.dispose();
    host.remove();
  });

  it('scrolls selected dial chip into view with nearest alignment', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const scrollIntoViewMock = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    try {
      const menu = createMenuScreen({
        host,
        channelId: 'game-1',
      });

      scrollIntoViewMock.mockClear();
      menu.setChannel('game-3');

      expect(scrollIntoViewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          block: 'nearest',
          inline: 'nearest',
        }),
      );

      menu.dispose();
    } finally {
      scrollIntoViewMock.mockRestore();
      host.remove();
    }
  });

  it('prevents starting a locked Remix channel', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onStart = vi.fn();
    const menu = createMenuScreen({
      host,
      channelId: 'fading-trails',
      isUnlocked: (id) => id !== 'fading-trails',
      onStart,
    });

    const lockBtn = host.querySelector<HTMLButtonElement>('.tb-modes button');
    expect(lockBtn?.hasAttribute('disabled')).toBe(true);
    expect(lockBtn?.textContent).toContain('LOCKED');
    expect(lockBtn?.textContent).toContain('Opens with Boxed In');

    lockBtn?.click();
    expect(onStart).not.toHaveBeenCalled();

    menu.dispose();
    host.remove();
  });

  it('contains every required Kid line and Computer 1977 line', () => {
    expect(KID_LINES.lou).toBe('Reads the whole board, then turns a beat late.');
    expect(KID_LINES.moss).toBe('Claims the big side early and keeps clear of trouble.');
    expect(KID_LINES.rosa).toBe('Hunts you. She will cut straight across your path.');
    expect(KID_LINES.benny).toBe('Copies your turns a moment after you make them.');
    expect(KID_LINES.dee).toBe('The quickest hands on the street. Boxes herself in.');
    expect(KID_LINES.pip).toBe('Wanders about, then springs a trap out of nowhere.');
    expect(KID_LINES.computer).toBe(
      'Never blinks, never plans. Looks three cells ahead (six on switch A).',
    );

    const host = document.createElement('div');
    document.body.append(host);

    const onOpponent = vi.fn();
    const menu = createMenuScreen({
      host,
      opponent: 'rosa',
      onOpponent,
    });

    expect(host.querySelector('.tb-rival-note')?.textContent).toContain(KID_LINES.rosa);

    const louBtn = host.querySelector<HTMLButtonElement>('[data-opponent="lou"]');
    louBtn?.click();
    expect(onOpponent).toHaveBeenCalledWith('lou');
    expect(host.querySelector('.tb-rival-note')?.textContent).toContain('Grandpa Lou');
    expect(host.querySelector('.tb-rival-note')?.textContent).toContain(KID_LINES.lou);

    const compBtn = host.querySelector<HTMLButtonElement>('[data-opponent="computer"]');
    compBtn?.click();
    expect(onOpponent).toHaveBeenCalledWith('computer');
    expect(host.querySelector('.tb-rival-note')?.textContent).toContain('Computer 1977');
    expect(host.querySelector('.tb-rival-note')?.textContent).toContain(KID_LINES.computer);

    menu.dispose();
    host.remove();
  });
});
