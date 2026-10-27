// @vitest-environment happy-dom
/**
 * Tests for Tank Duel modal sheets: generic Sheet focus, trap, Esc and backdrop,
 * Settings controls, granular updates and link, and Records Kid standings,
 * best bank line, and full channel table.
 */
import { describe, expect, it } from 'vitest';
import type { GameSettingsStore, RunRecord } from '@woodgrain-88/kit';
import { emptySave, type TankSave } from '../src/app/save.ts';
import {
  createTankSettings,
  DEFAULT_TANK_SETTINGS,
  type TankSettings,
  type TankSettingsStore,
} from '../src/app/settings.ts';
import { createRecordsScreen } from '../src/screens/records.ts';
import { createSettingsSheet } from '../src/screens/settings-sheet.ts';
import { createSheet } from '../src/screens/sheet.ts';

function createMemoryStore(initial: Record<string, unknown> = {}): GameSettingsStore {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    get<T>(key: string, fallback: T): T {
      return map.has(key) ? (map.get(key) as T) : fallback;
    },
    set(key: string, value: unknown): void {
      map.set(key, value);
    },
  };
}

function createTrackedSettings(initial: Record<string, unknown> = {}): {
  settings: TankSettingsStore;
  updates: Partial<TankSettings>[];
} {
  const raw = createTankSettings(createMemoryStore(initial));
  const updates: Partial<TankSettings>[] = [];
  const settings: TankSettingsStore = {
    get: () => raw.get(),
    update: (change) => {
      updates.push(change);
      return raw.update(change);
    },
    onChange: (listener) => raw.onChange(listener),
  };
  return { settings, updates };
}

describe('sheet', () => {
  it('calls onClose when Escape is pressed and when the close button is clicked', () => {
    const host = document.createElement('div');
    document.body.append(host);
    let closeCalls = 0;

    const sheet = createSheet({
      host,
      title: 'Test Sheet',
      onClose: () => {
        closeCalls++;
      },
    });

    const closeButton = host.querySelector<HTMLButtonElement>('.td-sheet-close');
    expect(closeButton).not.toBeNull();
    closeButton?.click();
    expect(closeCalls).toBe(1);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closeCalls).toBe(2);

    sheet.dispose();
    host.remove();
  });

  it('stops Escape from bubbling outside the sheet', () => {
    const parent = document.createElement('div');
    const host = document.createElement('div');
    parent.append(host);
    document.body.append(parent);

    let parentSawEscape = false;
    parent.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        parentSawEscape = true;
      }
    });

    let closeCalls = 0;
    const sheet = createSheet({
      host,
      title: 'Contained Sheet',
      onClose: () => {
        closeCalls++;
      },
    });

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closeCalls).toBe(1);
    expect(parentSawEscape).toBe(false);

    sheet.dispose();
    parent.remove();
  });

  it('moves focus inside on open, cycles with Tab, and returns focus on dispose', async () => {
    const host = document.createElement('div');
    const outside = document.createElement('button');
    outside.textContent = 'Outside target';
    document.body.append(outside, host);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const sheet = createSheet({
      host,
      title: 'Focus Modal',
      onClose: () => undefined,
    });

    const input = document.createElement('input');
    const action = document.createElement('button');
    action.textContent = 'Action';
    sheet.body.append(input, action);

    // Microtask moves focus to the first focusable element inside the sheet body
    await Promise.resolve();
    expect(document.activeElement).toBe(input);

    const closeButton = host.querySelector<HTMLButtonElement>('.td-sheet-close');
    expect(closeButton).not.toBeNull();

    // From the last element (action), forward Tab cycles to the first element (closeButton)
    action.focus();
    expect(document.activeElement).toBe(action);
    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(closeButton);

    // From the first element (closeButton), Shift+Tab cycles to the last element (action)
    closeButton?.focus();
    expect(document.activeElement).toBe(closeButton);
    closeButton?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(action);

    sheet.dispose();
    expect(document.activeElement).toBe(outside);

    outside.remove();
    host.remove();
  });

  it('removes markup on dispose', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const sheet = createSheet({
      host,
      title: 'Clean Sheet',
      onClose: () => undefined,
    });

    expect(host.children.length).toBeGreaterThan(0);
    sheet.dispose();
    expect(host.children.length).toBe(0);

    host.remove();
  });
});

describe('settings sheet', () => {
  it('reflects the current settings in each control', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings } = createTrackedSettings({
      'tank.scoring': 'first-to-10',
      'tank.wiring': true,
      'tank.aimLine': true,
      'tank.explosions': 'reduced',
      'tank.teamColours': 'colour-blind',
      'tank.engineVolume': 0.35,
      'tank.effectsVolume': 0.65,
    });

    const screen = createSettingsSheet({
      host,
      settings,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    const firstTo10 = host.querySelector<HTMLButtonElement>('[data-rule="first-to-10"]');
    const timed = host.querySelector<HTMLButtonElement>('[data-rule="timed"]');
    expect(firstTo10?.getAttribute('aria-checked')).toBe('true');
    expect(timed?.getAttribute('aria-checked')).toBe('false');

    const wiringSwitch = host.querySelector<HTMLButtonElement>('[data-setting="wiring"]');
    expect(wiringSwitch?.getAttribute('aria-checked')).toBe('true');

    const aimLineSwitch = host.querySelector<HTMLButtonElement>('[data-setting="aimLine"]');
    expect(aimLineSwitch?.getAttribute('aria-checked')).toBe('true');

    const reducedExp = host.querySelector<HTMLButtonElement>('[data-explosions="reduced"]');
    const fullExp = host.querySelector<HTMLButtonElement>('[data-explosions="full"]');
    expect(reducedExp?.getAttribute('aria-checked')).toBe('true');
    expect(fullExp?.getAttribute('aria-checked')).toBe('false');

    const cbColours = host.querySelector<HTMLButtonElement>('[data-team-colours="colour-blind"]');
    const stdColours = host.querySelector<HTMLButtonElement>('[data-team-colours="standard"]');
    expect(cbColours?.getAttribute('aria-checked')).toBe('true');
    expect(stdColours?.getAttribute('aria-checked')).toBe('false');

    const engineSlider = host.querySelector<HTMLInputElement>('input[data-setting="engineVolume"]');
    const effectsSlider = host.querySelector<HTMLInputElement>(
      'input[data-setting="effectsVolume"]',
    );
    expect(engineSlider?.value).toBe('35');
    expect(effectsSlider?.value).toBe('65');

    const enginePercent = host.querySelector<HTMLElement>('[data-value-for="engineVolume"]');
    const effectsPercent = host.querySelector<HTMLElement>('[data-value-for="effectsVolume"]');
    expect(enginePercent?.textContent).toBe('35%');
    expect(effectsPercent?.textContent).toBe('65%');

    screen.dispose();
    host.remove();
  });

  it('updates only the changed field when toggling wiring, choosing explosions, and moving a volume slider', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings, updates } = createTrackedSettings({
      'tank.wiring': false,
      'tank.explosions': 'full',
      'tank.engineVolume': DEFAULT_TANK_SETTINGS.engineVolume,
    });

    const screen = createSettingsSheet({
      host,
      settings,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    // 1. Toggling the wiring switch calls update with only wiring
    const wiringSwitch = host.querySelector<HTMLButtonElement>('[data-setting="wiring"]');
    wiringSwitch?.click();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ wiring: true });

    // 2. Choosing Reduced explosions calls update with only explosions
    const reducedBtn = host.querySelector<HTMLButtonElement>('[data-explosions="reduced"]');
    reducedBtn?.click();
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ explosions: 'reduced' });

    // 3. Moving the engine volume slider calls update with only engineVolume
    const engineSlider = host.querySelector<HTMLInputElement>('input[data-setting="engineVolume"]');
    expect(engineSlider).not.toBeNull();
    if (engineSlider) {
      engineSlider.value = '75';
      engineSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(updates).toHaveLength(3);
    expect(updates[2]).toEqual({ engineVolume: 0.75 });

    screen.dispose();
    host.remove();
  });

  it('calls onAllSettings when clicking the all-settings link', () => {
    const host = document.createElement('div');
    document.body.append(host);

    let allSettingsCalled = false;
    const { settings } = createTrackedSettings();

    const screen = createSettingsSheet({
      host,
      settings,
      onAllSettings: () => {
        allSettingsCalled = true;
      },
      onClose: () => undefined,
    });

    const link = host.querySelector<HTMLButtonElement>('.td-link');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Camera shake, appearance and controls');
    link?.click();
    expect(allSettingsCalled).toBe(true);

    screen.dispose();
    host.remove();
  });
});

describe('records screen', () => {
  it('displays the correct standings for each Kid', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const save: TankSave = {
      ...emptySave(),
      kids: {
        ...emptySave().kids,
        dee: { wins: 3, losses: 1, draws: 0 },
        moss: { wins: 0, losses: 2, draws: 1 },
      },
    };

    const screen = createRecordsScreen({
      host,
      save,
      best: () => null,
      onClose: () => undefined,
    });

    const photos = host.querySelectorAll<HTMLElement>('figure.td-photo');
    expect(photos).toHaveLength(6);

    const deeFigure = host.querySelector<HTMLElement>('[data-kid="dee"]');
    expect(deeFigure).not.toBeNull();
    expect(deeFigure?.tagName.toLowerCase()).toBe('figure');
    expect(deeFigure?.textContent).toContain('Dee');
    expect(deeFigure?.textContent).toContain('3–1–0');
    expect(deeFigure?.textContent).toContain('3 wins, 1 loss, no draws');

    const mossFigure = host.querySelector<HTMLElement>('[data-kid="moss"]');
    expect(mossFigure).not.toBeNull();
    expect(mossFigure?.textContent).toContain('Moss');
    expect(mossFigure?.textContent).toContain('0–2–1');
    expect(mossFigure?.textContent).toContain('no wins, 2 losses, 1 draw');

    screen.dispose();
    host.remove();
  });

  it('displays the best bank shot line when present and empty state when absent', () => {
    const hostEmpty = document.createElement('div');
    document.body.append(hostEmpty);

    const emptyScreen = createRecordsScreen({
      host: hostEmpty,
      save: emptySave(),
      best: () => null,
      onClose: () => undefined,
    });

    const emptyText = hostEmpty.querySelector('.td-records-bank')?.textContent;
    expect(emptyText).toBe('No bank shot yet. Bounce one in on a bouncing channel.');
    emptyScreen.dispose();
    hostEmpty.remove();

    const hostWithBank = document.createElement('div');
    document.body.append(hostWithBank);

    const saveWithBank: TankSave = {
      ...emptySave(),
      bestBank: {
        bounces: 4,
        channel: 'game-9',
        at: '2026-10-12T14:30:00.000Z',
      },
    };

    const bankScreen = createRecordsScreen({
      host: hostWithBank,
      save: saveWithBank,
      best: () => null,
      onClose: () => undefined,
    });

    const bankText = hostWithBank.querySelector('.td-records-bank')?.textContent;
    expect(bankText).toBe('×4 on CH 09 · Billiard · Old Quarter, 12 Oct 2026');

    bankScreen.dispose();
    hostWithBank.remove();
  });

  it('renders a table with 31 channel rows, best hits or an en dash, and played counts', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const save: TankSave = {
      ...emptySave(),
      played: {
        'game-1': 14,
        'game-5': 3,
        'last-tank': 7,
      },
    };

    const bestMap: Record<string, RunRecord> = {
      'game-1': {
        score: 9,
        at: '2026-10-15T12:00:00.000Z',
        seed: 42,
        durationMs: 164000,
        channel: 'game-1',
        mode: 'normal',
      },
    };

    const screen = createRecordsScreen({
      host,
      save,
      best: (channelId) => bestMap[channelId] ?? null,
      onClose: () => undefined,
    });

    const table = host.querySelector<HTMLTableElement>('table.td-records-table');
    expect(table).not.toBeNull();
    if (!table) throw new Error('records table is missing');

    const headerThs = table.querySelectorAll('thead th');
    expect(headerThs).toHaveLength(4);
    expect(headerThs[0]?.textContent).toBe('CH');
    expect(headerThs[1]?.textContent).toBe('Channel');
    expect(headerThs[2]?.textContent).toBe('Best');
    expect(headerThs[3]?.textContent).toBe('Played');

    const channelRows = table.querySelectorAll<HTMLTableRowElement>('tr.td-channel-row');
    expect(channelRows).toHaveLength(31);

    // Channel 1: has best score 9 and played 14
    const row1 = channelRows[0];
    expect(row1?.querySelector('.td-cell-ch')?.textContent).toBe('01');
    expect(row1?.querySelector('th[scope="row"]')?.textContent).toBe('Guided · Sandbags');
    expect(row1?.querySelector('.td-cell-best')?.textContent).toBe('9');
    expect(row1?.querySelector('.td-cell-played')?.textContent).toBe('14');

    // Channel 2: no best score (en dash) and 0 played
    const row2 = channelRows[1];
    expect(row2?.querySelector('.td-cell-ch')?.textContent).toBe('02');
    expect(row2?.querySelector('.td-cell-best')?.textContent).toBe('–');
    expect(row2?.querySelector('.td-cell-played')?.textContent).toBe('0');

    // Channel 5: no best score (en dash) and 3 played
    const row5 = channelRows[4];
    expect(row5?.querySelector('.td-cell-ch')?.textContent).toBe('05');
    expect(row5?.querySelector('.td-cell-best')?.textContent).toBe('–');
    expect(row5?.querySelector('.td-cell-played')?.textContent).toBe('3');

    // Channel 31: Last Tank (Remix)
    const row31 = channelRows[30];
    expect(row31?.querySelector('.td-cell-ch')?.textContent).toBe('31');
    expect(row31?.querySelector('th[scope="row"]')?.textContent).toBe('Last Tank');
    expect(row31?.querySelector('.td-cell-played')?.textContent).toBe('7');

    // Group headers
    const groupRows = table.querySelectorAll('tr.td-group-row');
    expect(groupRows).toHaveLength(5);
    const groupTitles = Array.from(groupRows).map((row) => row.textContent.trim());
    expect(groupTitles).toEqual(['Tanks', 'Invisible Tanks', 'Biplanes', 'Jets', 'Remix']);

    screen.dispose();
    host.remove();
  });
});
