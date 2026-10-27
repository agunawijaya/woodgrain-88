// @vitest-environment happy-dom
/**
 * The game menu's handicap line: each side's handicap in words, and a (?) that opens the
 * explanation of what a handicap is and where to set it; Escape or a click elsewhere closes it.
 */
import { describe, expect, it } from 'vitest';
import { channelById } from '../src/engine/channels.ts';
import { createMenuScreen, type MenuScreen } from '../src/screens/menu.ts';

function openMenu(): { menu: MenuScreen; host: HTMLElement } {
  const host = document.createElement('div');
  document.body.append(host);
  const menu = createMenuScreen({
    host,
    channel: channelById('game-1'),
    kid: 'lou',
    scoring: 'timed',
    switches: { left: 'B', right: 'B' },
    onStart: () => undefined,
    onKid: () => undefined,
    onScoring: () => undefined,
    onHowToPlay: () => undefined,
    onSettings: () => undefined,
    onRecords: () => undefined,
  });
  menu.show();
  return { menu, host };
}

describe('menu handicap line', () => {
  it('says each side’s handicap in words, following the console switches', () => {
    const { menu, host } = openMenu();
    const line = host.querySelector('.td-switches');
    expect(line?.textContent).toBe('You: noneOpponent: none');

    menu.setSwitches({ left: 'A', right: 'B' });
    expect(line?.textContent).toBe('You: shorter shotsOpponent: none');
    menu.dispose();
  });

  it('opens the explanation from the (?) and closes it again with Escape', () => {
    const { menu, host } = openMenu();
    const help = host.querySelector<HTMLButtonElement>('.td-help');
    const text = host.querySelector<HTMLElement>('.td-help-text');
    if (!help || !text) throw new Error('the handicap help is missing');
    expect(text.hidden).toBe(true);

    help.click();
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(text.hidden).toBe(false);
    expect(text.textContent).toContain('evens out a match');

    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(help.getAttribute('aria-expanded')).toBe('false');
    expect(text.hidden).toBe(true);

    // A click anywhere else in the menu closes it too.
    help.click();
    host.querySelector('.td-line')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(text.hidden).toBe(true);
    menu.dispose();
  });
});
