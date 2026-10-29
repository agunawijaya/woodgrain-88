// @vitest-environment happy-dom
/**
 * Tests for Trailblaze modal sheets: records empty and populated states,
 * gallery empty state and two-step delete confirmation, and settings sheet
 * updating store with expected patches for each control.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GameSettingsStore } from '@woodgrain-88/kit';
import {
  createTrailblazeSettings,
  type TrailblazeSettings,
  type TrailblazeSettingsStore,
} from '../../src/app/settings.ts';
import { emptySave, type DoodleEntry, type TrailblazeSave } from '../../src/app/save.ts';
import { encodeBoard } from '../../src/doodle/board.ts';
import { createGalleryScreen } from '../../src/screens/gallery.ts';
import { createRecordsScreen } from '../../src/screens/records.ts';
import { createSettingsSheet } from '../../src/screens/settings-sheet.ts';

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
  settings: TrailblazeSettingsStore;
  updates: Partial<TrailblazeSettings>[];
} {
  const raw = createTrailblazeSettings(createMemoryStore(initial));
  const updates: Partial<TrailblazeSettings>[] = [];
  const settings: TrailblazeSettingsStore = {
    get: () => raw.get(),
    update: (change) => {
      updates.push(change);
      return raw.update(change);
    },
    onChange: (listener) => raw.onChange(listener),
  };
  return { settings, updates };
}

describe('records screen', () => {
  it('displays empty state when no records exist', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const sheet = createRecordsScreen({
      host,
      save: emptySave(),
      onClose: () => undefined,
    });

    const emptyText = host.querySelector('.tb-records-empty')?.textContent;
    expect(emptyText).toBe('No matches yet. Your records fill in as you ride.');
    expect(host.querySelector('table')).toBeNull();

    sheet.dispose();
    host.remove();
  });

  it('renders records grouped by channel group with correct columns', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const save: TrailblazeSave = {
      ...emptySave(),
      records: {
        'game-1|kid:rosa|human': {
          played: 10,
          won: 7,
          lost: 3,
          bestMargin: 4,
          longestRide: 18.2,
        },
        'game-8|computer|-': {
          played: 5,
          won: 4,
          lost: 1,
          bestMargin: 6,
          longestRide: 22.4,
        },
      },
    };

    const sheet = createRecordsScreen({
      host,
      save,
      onClose: () => undefined,
    });

    const tables = host.querySelectorAll('table.tb-records-table');
    expect(tables).toHaveLength(2);

    const groupTitles = Array.from(host.querySelectorAll('.tb-records-group-title')).map(
      (el) => el.textContent,
    );
    expect(groupTitles).toContain('Bordered');
    expect(groupTitles).toContain('Wraparound');

    const rows = host.querySelectorAll('tbody tr.tb-records-row');
    expect(rows).toHaveLength(2);

    // Row 0: game-1
    expect(rows[0]?.textContent).toContain('Classic');
    expect(rows[0]?.textContent).toContain('Rosa');
    expect(rows[0]?.textContent).toContain('Human');
    expect(rows[0]?.textContent).toContain('10');
    expect(rows[0]?.textContent).toContain('+4');
    expect(rows[0]?.textContent).toContain('18.2s');

    // Row 1: game-8
    expect(rows[1]?.textContent).toContain('Wraparound');
    expect(rows[1]?.textContent).toContain('Computer 1977');
    expect(rows[1]?.textContent).toContain('5');
    expect(rows[1]?.textContent).toContain('+6');
    expect(rows[1]?.textContent).toContain('22.4s');

    sheet.dispose();
    host.remove();
  });
});

describe('doodle gallery screen', () => {
  it('displays empty state when gallery has no drawings', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const sheet = createGalleryScreen({
      host,
      doodles: [],
      onClose: () => undefined,
    });

    const emptyText = host.querySelector('.tb-gallery-empty')?.textContent;
    expect(emptyText).toBe('Draw something in a Doodle channel and press X to keep it here.');
    expect(host.querySelector('.tb-gallery-tile')).toBeNull();

    sheet.dispose();
    host.remove();
  });

  it('requires two clicks to confirm deleting a doodle', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const onDelete = vi.fn();
    const cells = new Int8Array(800);
    const board = encodeBoard(cells);

    const doodles: DoodleEntry[] = [
      {
        id: '12345678-game-13',
        channelId: 'game-13',
        look: 'neon',
        savedAt: 1729000000000,
        board,
        filledPercent: 15,
      },
    ];

    const sheet = createGalleryScreen({
      host,
      doodles,
      onDelete,
      onClose: () => undefined,
    });

    const deleteBtn = host.querySelector<HTMLButtonElement>('.tb-btn-delete');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toBe('Delete');

    // First click: asks for confirmation
    deleteBtn?.click();
    expect(onDelete).not.toHaveBeenCalled();
    expect(deleteBtn?.textContent).toBe('Confirm delete?');
    expect(deleteBtn?.classList.contains('is-confirming')).toBe(true);

    // Second click: confirms deletion
    deleteBtn?.click();
    expect(onDelete).toHaveBeenCalledWith('12345678-game-13');

    sheet.dispose();
    host.remove();
  });
});

describe('settings sheet', () => {
  it('updates the store with the right patch for each control', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const { settings, updates } = createTrackedSettings({
      'tb.look': 'neon',
      'tb.matchLength': 10,
      'tb.camera': 'overhead',
      'tb.colourBlind': false,
      'tb.reducedEffects': false,
    });

    const sheet = createSettingsSheet({
      host,
      settings,
      onClose: () => undefined,
    });

    // 1. Look: click trains
    const trainsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="look"][data-val="trains"]',
    );
    trainsBtn?.click();
    expect(updates).toContainEqual({ look: 'trains' });

    // 2. Match length: click 5
    const len5Btn = host.querySelector<HTMLButtonElement>(
      '[data-field="matchLength"][data-val="5"]',
    );
    len5Btn?.click();
    expect(updates).toContainEqual({ matchLength: 5 });

    // 3. Camera: click chase
    const chaseBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="camera"][data-val="chase"]',
    );
    chaseBtn?.click();
    expect(updates).toContainEqual({ camera: 'chase' });

    // 4. Colour-blind: click true
    const cbBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="colourBlind"][data-val="true"]',
    );
    cbBtn?.click();
    expect(updates).toContainEqual({ colourBlind: true });

    // 5. Reduced effects: click true
    const effectsBtn = host.querySelector<HTMLButtonElement>(
      '[data-field="reducedEffects"][data-val="true"]',
    );
    effectsBtn?.click();
    expect(updates).toContainEqual({ reducedEffects: true });

    // Speed-up preview bars are present
    const bars = host.querySelectorAll('.tb-preview-bar');
    expect(bars).toHaveLength(5);

    sheet.dispose();
    host.remove();
  });
});
