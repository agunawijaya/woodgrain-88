// @vitest-environment happy-dom
/**
 * Tests for Hot & Cold modal sheets: Settings controls, granular updates,
 * fog locking, store synchronization, all-settings link, and Records Kid standings,
 * clean streak sentence, best runs table in channel order, and empty state.
 */
import { describe, expect, it } from 'vitest';
import type { GameSettingsStore } from '@woodgrain-88/kit';
import { emptySave, type HotColdSave } from '../src/app/save.ts';
import {
  createHotColdSettings,
  type HotColdSettings,
  type HotColdSettingsStore,
} from '../src/app/settings.ts';
import { createRecordsScreen } from '../src/screens/records.ts';
import { createSettingsSheet } from '../src/screens/settings-sheet.ts';

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
  settings: HotColdSettingsStore;
  updates: Partial<HotColdSettings>[];
} {
  const raw = createHotColdSettings(createMemoryStore(initial));
  const updates: Partial<HotColdSettings>[] = [];
  const settings: HotColdSettingsStore = {
    get: () => raw.get(),
    update: (change) => {
      updates.push(change);
      return raw.update(change);
    },
    onChange: (listener) => raw.onChange(listener),
  };
  return { settings, updates };
}

describe('settings sheet', () => {
  it('reflects the current settings in each row', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings } = createTrackedSettings({
      'hc.look': 'radar',
      'hc.clues': 'classic',
      'hc.fog': true,
      'hc.matchLength': 'short',
      'hc.clueColours': 'colour-blind',
      'hc.seatColours': 'colour-blind',
      'hc.effects': 'reduced',
      'hc.effectsVolume': 0.35,
    });

    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: null,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    const radarBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="look"][data-value="radar"]',
    );
    const polarBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="look"][data-value="polar"]',
    );
    expect(radarBtn?.getAttribute('aria-checked')).toBe('true');
    expect(radarBtn?.tabIndex).toBe(0);
    expect(polarBtn?.getAttribute('aria-checked')).toBe('false');
    expect(polarBtn?.tabIndex).toBe(-1);

    const classicBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="clues"][data-value="classic"]',
    );
    const notebookBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="clues"][data-value="notebook"]',
    );
    expect(classicBtn?.getAttribute('aria-checked')).toBe('true');
    expect(notebookBtn?.getAttribute('aria-checked')).toBe('false');

    const fogOnBtn = host.querySelector<HTMLButtonElement>('[data-field="fog"][data-value="true"]');
    const fogOffBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="fog"][data-value="false"]',
    );
    expect(fogOnBtn?.getAttribute('aria-checked')).toBe('true');
    expect(fogOffBtn?.getAttribute('aria-checked')).toBe('false');

    const shortBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="matchLength"][data-value="short"]',
    );
    const cartridgeBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="matchLength"][data-value="cartridge"]',
    );
    expect(shortBtn?.getAttribute('aria-checked')).toBe('true');
    expect(cartridgeBtn?.getAttribute('aria-checked')).toBe('false');

    const cbCluesBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="clueColours"][data-value="colour-blind"]',
    );
    const stdCluesBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="clueColours"][data-value="standard"]',
    );
    expect(cbCluesBtn?.getAttribute('aria-checked')).toBe('true');
    expect(stdCluesBtn?.getAttribute('aria-checked')).toBe('false');

    const cbSeatsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="seatColours"][data-value="colour-blind"]',
    );
    const stdSeatsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="seatColours"][data-value="standard"]',
    );
    expect(cbSeatsBtn?.getAttribute('aria-checked')).toBe('true');
    expect(stdSeatsBtn?.getAttribute('aria-checked')).toBe('false');

    const redEffectsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="effects"][data-value="reduced"]',
    );
    const fullEffectsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="effects"][data-value="full"]',
    );
    expect(redEffectsBtn?.getAttribute('aria-checked')).toBe('true');
    expect(fullEffectsBtn?.getAttribute('aria-checked')).toBe('false');

    const volumeSlider = host.querySelector<HTMLInputElement>('.hc-volume-slider');
    expect(volumeSlider?.value).toBe('35');

    const volumeDisplay = host.querySelector<HTMLElement>('.hc-volume-value');
    expect(volumeDisplay?.textContent).toBe('35%');

    sheet.dispose();
    host.remove();
  });

  it('updates the store when clicking an option in any row', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings, updates } = createTrackedSettings({
      'hc.look': 'polar',
      'hc.clues': 'notebook',
      'hc.fog': false,
      'hc.matchLength': 'cartridge',
      'hc.clueColours': 'standard',
      'hc.seatColours': 'standard',
      'hc.effects': 'full',
    });

    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: null,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    const tabletopBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="look"][data-value="tabletop"]',
    );
    tabletopBtn?.click();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ look: 'tabletop' });

    const classicBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="clues"][data-value="classic"]',
    );
    classicBtn?.click();
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ clues: 'classic' });

    const fogOnBtn = host.querySelector<HTMLButtonElement>('[data-field="fog"][data-value="true"]');
    fogOnBtn?.click();
    expect(updates).toHaveLength(3);
    expect(updates[2]).toEqual({ fog: true });

    const shortBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="matchLength"][data-value="short"]',
    );
    shortBtn?.click();
    expect(updates).toHaveLength(4);
    expect(updates[3]).toEqual({ matchLength: 'short' });

    const cbCluesBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="clueColours"][data-value="colour-blind"]',
    );
    cbCluesBtn?.click();
    expect(updates).toHaveLength(5);
    expect(updates[4]).toEqual({ clueColours: 'colour-blind' });

    const cbSeatsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="seatColours"][data-value="colour-blind"]',
    );
    cbSeatsBtn?.click();
    expect(updates).toHaveLength(6);
    expect(updates[5]).toEqual({ seatColours: 'colour-blind' });

    const redEffectsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="effects"][data-value="reduced"]',
    );
    redEffectsBtn?.click();
    expect(updates).toHaveLength(7);
    expect(updates[6]).toEqual({ effects: 'reduced' });

    sheet.dispose();
    host.remove();
  });

  it('updates effectsVolume when moving the volume input', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings, updates } = createTrackedSettings({
      'hc.effectsVolume': 0.8,
    });

    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: null,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    const slider = host.querySelector<HTMLInputElement>('.hc-volume-slider');
    expect(slider).not.toBeNull();
    if (slider) {
      slider.value = '65';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ effectsVolume: 0.65 });

    sheet.dispose();
    host.remove();
  });

  it('disables fog options and displays the reason when fogLocked is given', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings, updates } = createTrackedSettings({
      'hc.fog': false,
    });

    const reason = 'Fog is locked for this daily field challenge.';
    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: reason,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    const fogOnBtn = host.querySelector<HTMLButtonElement>('[data-field="fog"][data-value="true"]');
    const fogOffBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="fog"][data-value="false"]',
    );
    expect(fogOnBtn?.disabled).toBe(true);
    expect(fogOffBtn?.disabled).toBe(true);

    const fogHelp = host.querySelector<HTMLElement>('[data-note-for="fog"]');
    expect(fogHelp?.textContent).toBe(reason);

    fogOnBtn?.click();
    expect(updates).toHaveLength(0);

    sheet.dispose();
    host.remove();
  });

  it('re-checks options when changes are made through the store directly', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings } = createTrackedSettings({
      'hc.look': 'polar',
      'hc.effectsVolume': 0.8,
    });

    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: null,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    const polarBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="look"][data-value="polar"]',
    );
    const radarBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="look"][data-value="radar"]',
    );
    expect(polarBtn?.getAttribute('aria-checked')).toBe('true');
    expect(radarBtn?.getAttribute('aria-checked')).toBe('false');

    settings.update({ look: 'radar', effectsVolume: 0.45 });

    expect(polarBtn?.getAttribute('aria-checked')).toBe('false');
    expect(radarBtn?.getAttribute('aria-checked')).toBe('true');
    expect(radarBtn?.tabIndex).toBe(0);
    expect(polarBtn?.tabIndex).toBe(-1);

    const slider = host.querySelector<HTMLInputElement>('.hc-volume-slider');
    const display = host.querySelector<HTMLElement>('.hc-volume-value');
    expect(slider?.value).toBe('45');
    expect(display?.textContent).toBe('45%');

    sheet.dispose();
    host.remove();
  });

  it('calls onAllSettings when clicking "All settings…"', () => {
    const host = document.createElement('div');
    document.body.append(host);

    let allSettingsCalled = false;
    const { settings } = createTrackedSettings();

    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: null,
      onAllSettings: () => {
        allSettingsCalled = true;
      },
      onClose: () => undefined,
    });

    const link = host.querySelector<HTMLButtonElement>('.hc-link');
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('All settings…');
    link?.click();
    expect(allSettingsCalled).toBe(true);

    sheet.dispose();
    host.remove();
  });

  it('removes the sheet on dispose and stops listening to store changes', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings } = createTrackedSettings({
      'hc.look': 'polar',
    });

    const sheet = createSettingsSheet({
      host,
      settings,
      fogLocked: null,
      onAllSettings: () => undefined,
      onClose: () => undefined,
    });

    expect(host.children.length).toBeGreaterThan(0);
    sheet.dispose();
    expect(host.children.length).toBe(0);

    // Further store updates should not cause exceptions or DOM updates
    settings.update({ look: 'radar' });
    expect(host.children.length).toBe(0);

    host.remove();
  });
});

describe('records screen', () => {
  it('displays W–L–D records for each Kid in KIDS order', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const save: HotColdSave = {
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
      onClose: () => undefined,
    });

    const figures = host.querySelectorAll<HTMLElement>('figure.hc-records-kid');
    expect(figures).toHaveLength(6);

    const deeFigure = host.querySelector<HTMLElement>('[data-kid="dee"]');
    expect(deeFigure).not.toBeNull();
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

  it('displays the streak sentence in singular and plural form', () => {
    const hostSingular = document.createElement('div');
    document.body.append(hostSingular);

    const saveSingular: HotColdSave = {
      ...emptySave(),
      cleanStreak: 1,
    };

    const screenSingular = createRecordsScreen({
      host: hostSingular,
      save: saveSingular,
      onClose: () => undefined,
    });

    const textSingular = hostSingular.querySelector('.hc-records-streak')?.textContent;
    expect(textSingular).toBe('You have found 1 flag in a row without setting off a bomb.');
    screenSingular.dispose();
    hostSingular.remove();

    const hostPlural = document.createElement('div');
    document.body.append(hostPlural);

    const savePlural: HotColdSave = {
      ...emptySave(),
      cleanStreak: 4,
    };

    const screenPlural = createRecordsScreen({
      host: hostPlural,
      save: savePlural,
      onClose: () => undefined,
    });

    const textPlural = hostPlural.querySelector('.hc-records-streak')?.textContent;
    expect(textPlural).toBe('You have found 4 flags in a row without setting off a bomb.');
    screenPlural.dispose();
    hostPlural.remove();

    const hostZero = document.createElement('div');
    document.body.append(hostZero);

    const saveZero: HotColdSave = {
      ...emptySave(),
      cleanStreak: 0,
    };

    const screenZero = createRecordsScreen({
      host: hostZero,
      save: saveZero,
      onClose: () => undefined,
    });

    const textZero = hostZero.querySelector('.hc-records-streak')?.textContent;
    expect(textZero).toBe('You have found 0 flags in a row without setting off a bomb.');
    screenZero.dispose();
    hostZero.remove();
  });

  it('renders best rows in channel order with readable clues, memory, and mode', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const save: HotColdSave = {
      ...emptySave(),
      played: {
        'game-1': 12,
        'game-2': 5,
        'two-flags': 3,
      },
      bests: {
        // Provided in arbitrary order: Two Flags, Game 2, Game 1
        'two-flags|versus-night|classic|sharp': {
          score: 8,
          label: '8 flags',
          at: '2026-10-18T20:15:00.000Z',
        },
        'game-2|power-cycle-run|notebook|human': {
          score: 15,
          label: '15 flags',
          at: '2026-10-14T11:00:00.000Z',
        },
        'game-1|normal|notebook|human': {
          score: 15,
          label: '15 flags',
          at: '2026-10-12T10:00:00.000Z',
        },
        'game-1|challenge|classic|sharp': {
          score: 11,
          label: '11 flags',
          at: '2026-10-13T14:30:00.000Z',
        },
      },
    };

    const screen = createRecordsScreen({
      host,
      save,
      onClose: () => undefined,
    });

    const table = host.querySelector<HTMLTableElement>('table.hc-records-table');
    expect(table).not.toBeNull();

    const headers = Array.from(host.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers).toEqual(['Channel', 'Played', 'Clues', 'Kid memory', 'Mode', 'Best', 'When']);

    const rows = host.querySelectorAll<HTMLTableRowElement>('tbody tr.hc-records-row');
    expect(rows).toHaveLength(4);

    // Row 0: game-1 normal
    expect(rows[0]?.querySelector('th[scope="row"]')?.textContent).toBe('Race');
    expect(rows[0]?.querySelector('.hc-cell-played')?.textContent).toBe('12');
    expect(rows[0]?.querySelector('.hc-cell-clues')?.textContent).toBe('Notebook');
    expect(rows[0]?.querySelector('.hc-cell-memory')?.textContent).toBe('Human');
    expect(rows[0]?.querySelector('.hc-cell-mode')?.textContent).toBe('Normal');
    expect(rows[0]?.querySelector('.hc-cell-best')?.textContent).toBe('15 flags');
    expect(rows[0]?.querySelector('.hc-cell-when')?.textContent).toBe('2026-10-12');

    // Row 1: game-1 challenge
    expect(rows[1]?.querySelector('th[scope="row"]')?.textContent).toBe('Race');
    expect(rows[1]?.querySelector('.hc-cell-played')?.textContent).toBe('12');
    expect(rows[1]?.querySelector('.hc-cell-clues')?.textContent).toBe('Classic Memory');
    expect(rows[1]?.querySelector('.hc-cell-memory')?.textContent).toBe('Sharp');
    expect(rows[1]?.querySelector('.hc-cell-mode')?.textContent).toBe('Challenge');
    expect(rows[1]?.querySelector('.hc-cell-best')?.textContent).toBe('11 flags');
    expect(rows[1]?.querySelector('.hc-cell-when')?.textContent).toBe('2026-10-13');

    // Row 2: game-2
    expect(rows[2]?.querySelector('th[scope="row"]')?.textContent).toBe('Turns');
    expect(rows[2]?.querySelector('.hc-cell-played')?.textContent).toBe('5');
    expect(rows[2]?.querySelector('.hc-cell-clues')?.textContent).toBe('Notebook');
    expect(rows[2]?.querySelector('.hc-cell-memory')?.textContent).toBe('Human');
    expect(rows[2]?.querySelector('.hc-cell-mode')?.textContent).toBe('Run');
    expect(rows[2]?.querySelector('.hc-cell-best')?.textContent).toBe('15 flags');
    expect(rows[2]?.querySelector('.hc-cell-when')?.textContent).toBe('2026-10-14');

    // Row 3: two-flags
    expect(rows[3]?.querySelector('th[scope="row"]')?.textContent).toBe('Two Flags');
    expect(rows[3]?.querySelector('.hc-cell-played')?.textContent).toBe('3');
    expect(rows[3]?.querySelector('.hc-cell-clues')?.textContent).toBe('Classic Memory');
    expect(rows[3]?.querySelector('.hc-cell-memory')?.textContent).toBe('Sharp');
    expect(rows[3]?.querySelector('.hc-cell-mode')?.textContent).toBe('Versus Night');
    expect(rows[3]?.querySelector('.hc-cell-best')?.textContent).toBe('8 flags');
    expect(rows[3]?.querySelector('.hc-cell-when')?.textContent).toBe('2026-10-18');

    screen.dispose();
    host.remove();
  });

  it('skips unknown channels in bests and displays empty state when no bests exist', () => {
    const hostWithUnknownOnly = document.createElement('div');
    document.body.append(hostWithUnknownOnly);

    const saveWithUnknown: HotColdSave = {
      ...emptySave(),
      bests: {
        'game-999|normal|notebook|human': {
          score: 10,
          label: '10 flags',
          at: '2026-10-15T12:00:00.000Z',
        },
      },
    };

    const screenWithUnknown = createRecordsScreen({
      host: hostWithUnknownOnly,
      save: saveWithUnknown,
      onClose: () => undefined,
    });

    expect(hostWithUnknownOnly.querySelector('table')).toBeNull();
    const emptyText = hostWithUnknownOnly.querySelector('.hc-records-empty')?.textContent;
    expect(emptyText).toBe('No best runs yet. Find a flag and one appears here.');

    screenWithUnknown.dispose();
    hostWithUnknownOnly.remove();

    const hostEmpty = document.createElement('div');
    document.body.append(hostEmpty);

    const screenEmpty = createRecordsScreen({
      host: hostEmpty,
      save: emptySave(),
      onClose: () => undefined,
    });

    expect(hostEmpty.querySelector('table')).toBeNull();
    const emptyMsg = hostEmpty.querySelector('.hc-records-empty')?.textContent;
    expect(emptyMsg).toBe('No best runs yet. Find a flag and one appears here.');

    screenEmpty.dispose();
    hostEmpty.remove();
  });
});
