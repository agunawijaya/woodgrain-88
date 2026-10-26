/**
 * Game details: a big live picture on its own little CRT, the teaser, who it
 * is for and how long it takes, the controls, the channels, the patches with
 * their thresholds, your records, and the ways in (Play, How to play).
 */
import {
  createCrt,
  createPatchTracker,
  resolveVersion,
  type DemoHandle,
  type GameEntry,
  type GameModule,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { counterDigits } from '../data/cycle.ts';
import { FAMILY_NAMES } from '../data/registry.ts';
import { labelDocument } from '../den/label.ts';
import { slateDemo, SLATE_SIZE } from '../den/slate.ts';
import { escapeXml } from '../den/svg.ts';
import { openDialog, type Dialog } from './dialog.ts';
import { showHowToPlay } from './how-to-play.ts';
import { bindVersionPicker, chosenVersion, versionPickerMarkup } from './version-picker.ts';

export interface DetailsOptions {
  services: Services;
  entry: GameEntry;
  /** The cartridge version to show first (a Den channel asks for one); else the saved choice. */
  version?: string;
  onPlay(id: string, version?: string): void;
  onClose?(): void;
}

function playersText(players: string, versus: string): string {
  const who = players === '1P' ? '1 player' : players === '2P' ? '2 players' : '1 or 2 players';
  if (versus === 'local') return `${who}, couch versus`;
  if (versus === 'local+bot') return `${who}, couch versus or against the neighbourhood kids`;
  return who;
}

export function openDetails(options: DetailsOptions): Dialog {
  const { services, entry } = options;
  const { manifest } = entry;
  const soon = manifest.status === 'coming-soon' || !entry.load;
  let demo: DemoHandle | null = null;
  let module: GameModule | null = null;
  let picked = resolveVersion(manifest, options.version, chosenVersion(services, manifest));
  const versionSection =
    picked === undefined
      ? ''
      : `<section class="details-section details-versions"><h3>Cartridge version</h3>${versionPickerMarkup(manifest, picked)}</section>`;

  const dialog = openDialog({
    title: manifest.title,
    className: 'dialog--details',
    closeButton: true,
    onClose: () => {
      demo?.dispose();
      crt.dispose();
      options.onClose?.();
    },
  });

  const best = services.records.bestOverall(manifest.id, manifest.scoreOrder);
  const stats = services.stats.game(manifest.id);
  dialog.body.innerHTML =
    `<div class="details-grid">` +
    `<div class="details-tv"><div class="details-screen" aria-hidden="true"></div><div class="details-glass" aria-hidden="true"></div></div>` +
    `<div class="details-text">` +
    `<p class="dialog-kicker">CH ${counterDigits(manifest.slot)} · ${FAMILY_NAMES[manifest.family]}${soon ? ' · coming soon' : ''}</p>` +
    `<p class="details-teaser">${escapeXml(manifest.teaser)}</p>` +
    `<ul class="details-facts">` +
    `<li>${escapeXml(playersText(manifest.players, manifest.versus))}</li>` +
    `<li>${manifest.sessionMinutes[0]}–${manifest.sessionMinutes[1]} minutes a game</li>` +
    `<li>Inspired by ${escapeXml(manifest.inspiredBy.uiTitle)}</li>` +
    `</ul>` +
    `<div class="details-actions">` +
    (soon
      ? `<button type="button" class="button button--primary" aria-disabled="true">Coming soon</button>`
      : `<button type="button" class="button button--primary" data-do="play">Play</button><button type="button" class="button" data-do="how">How to play</button>`) +
    `</div>` +
    `</div>` +
    `<section class="details-section"><h3>Controls</h3><ul class="details-controls">${manifest.controls
      .map((hint) => `<li>${hint.keys.map((key) => `<span class="kbd">${escapeXml(key)}</span>`).join(' ')} <span>${escapeXml(hint.does)}${hint.seat ? ` (seat ${hint.seat})` : ''}</span></li>`)
      .join('')}</ul></section>` +
    `<section class="details-section"><h3>Channels</h3><ul class="details-channels">${services.channels
      .list(manifest.id)
      .map((channel) => `<li><strong>${escapeXml(channel.title)}</strong> ${escapeXml(channel.description)}${channel.unlocked ? '' : ' <em>(locked)</em>'}</li>`)
      .join('')}</ul></section>` +
    versionSection +
    `<section class="details-section"><h3>Patches</h3><div data-ref="patches"><p class="settings-note">${soon ? 'Patches arrive with the game.' : 'Loading…'}</p></div></section>` +
    `<section class="details-section"><h3>Your records</h3><p>${best ? `Best ${best.score.toLocaleString('en-GB')} on ${new Date(best.at).toLocaleDateString()}` : 'No runs yet.'} · ${stats.plays} plays</p></section>` +
    `<div class="details-label" aria-hidden="true">${labelDocument(manifest, `details-${manifest.id}`)}</div>` +
    `</div>`;

  const screen = dialog.body.querySelector<HTMLDivElement>('.details-screen');
  if (!screen) throw new Error('Details markup is missing its screen');
  const crt = createCrt(screen, {
    effects: services.settings.crtEnabled(),
    reducedMotion: services.settings.reducedMotion(),
    scanlineRows: SLATE_SIZE.height / 1.5,
  });
  const demoContext = () => ({
    appearance: services.settings.appearance(),
    reducedMotion: services.settings.reducedMotion(),
    width: SLATE_SIZE.width,
    height: SLATE_SIZE.height,
    ...(picked === undefined ? {} : { version: picked }),
  });
  const offscreen = document.createElement('div');
  const showDemo = (handle: DemoHandle) => {
    demo?.dispose();
    demo = handle;
    crt.setSource(handle.surface);
  };
  const showPickedDemo = () =>
    showDemo(module ? module.demo(offscreen, manifest.slot, demoContext()) : slateDemo(offscreen, manifest, demoContext()));
  showPickedDemo();
  void crt.powerOn({ snowMs: 220 });

  if (entry.load) {
    void entry.load().then((loaded) => {
      if (!dialog.open) return;
      module = loaded;
      showPickedDemo();
      const patches = dialog.body.querySelector<HTMLDivElement>('[data-ref="patches"]');
      if (patches) {
        const tracker = createPatchTracker({
          games: [{ id: manifest.id, patches: loaded.patches }],
          progress: services.repos.progress,
          isPro: () => false,
        });
        const status = new Map(tracker.status(manifest.id).map((s) => [s.def.id, s]));
        patches.innerHTML = `<ul class="details-patches">${loaded.patches
          .map((patch) => {
            const earned = status.get(patch.id)?.earned ?? false;
            const text = patch.tier === 'secret' && !earned ? (patch.hint ?? '') : patch.description;
            return `<li class="patch patch--${patch.tier}${earned ? ' is-earned' : ''}"><strong>${escapeXml(patch.title)}</strong> <span>${escapeXml(text)}</span></li>`;
          })
          .join('')}</ul>`;
      }
    });
  }

  dialog.body.addEventListener('click', (event) => {
    const what = (event.target as Element).closest<HTMLButtonElement>('[data-do]')?.dataset.do;
    if (what === 'play') {
      dialog.close();
      options.onPlay(manifest.id, picked);
    } else if (what === 'how' && module) {
      showHowToPlay(module);
    }
  });
  // Picking a version saves it and puts that version on the little TV.
  bindVersionPicker(dialog.body, services, manifest, (versionId) => {
    picked = versionId;
    showPickedDemo();
  });
  return dialog;
}
