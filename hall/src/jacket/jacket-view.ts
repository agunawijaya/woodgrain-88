/**
 * The Jacket screen: the denim jacket from the door, full size, and the
 * drawer of patches beside it. Earned patches are dragged onto the jacket
 * (or picked with the keyboard and moved with the arrows), snap to a free
 * spot, turn in 15° steps, swap when dropped on each other, and come off
 * again by dropping them back in the drawer. Locked patches wait in the
 * drawer as dashed outlines with their goal; secret ones as a "?" and a hint.
 *
 * Clicking a patch (or Enter on one in the drawer) shows it up close, with
 * what it is for and how far along the player is.
 *
 * Every change is one step of undo history and is saved at once. Opening
 * the screen counts as looking at the jacket, which stops the door jacket's
 * glint.
 */
import { copyText, downloadText, type PatchDef, type PatchPlacement, type PatchTier } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { toast } from '../chrome/dialog.ts';
import { FAMILY_NAMES } from '../data/registry.ts';
import { escapeXml, n } from '../den/svg.ts';
import {
  autoArrange,
  dropPatch,
  filterDrawer,
  nudgePatch,
  patchKey,
  PATCH_UNITS,
  removePatch,
  rotatePatch,
  unsewn,
  type DrawerFilter,
  type DrawerPatch,
  type JacketSide,
} from './arrange.ts';
import { BLOCK_CHAMPION, blockChampionStatus, DEN_OWNER } from './den-patches.ts';
import { earnedDrawer } from './drawer.ts';
import { createHistory } from './history.ts';
import { jacketCloth, jacketDefs, jacketLight, jacketOutline } from './jacket-art.ts';
import { patchArt, patchImage, patchImg, type PatchOwner } from './patch-look.ts';
import { openPatchPopover } from './patch-popover.ts';

export interface JacketView {
  readonly element: HTMLElement;
  dispose(): void;
}

const VIEW_BOX = { x: -20, y: -40, width: 640, height: 760 };
const TIER_NAMES: Record<PatchTier, string> = { club: 'Club', pro: 'Pro', legend: 'Legend', secret: 'Secret' };
/** Drawn sizes vary by tier, as real patches do; every one still takes the same room in the layout. */
const TIER_SIZE: Record<PatchTier, number> = { club: 84, pro: 90, legend: 102, secret: 78 };
/** A sleeve is narrower than a patch; patches sewn there are the small kind. */
const SLEEVE_SCALE = 0.74;

function drawnSize(tier: PatchTier, placement: PatchPlacement): number {
  const onSleeve = placement.x < 110 || placement.x > 490;
  return Math.round(TIER_SIZE[tier] * (onSleeve ? SLEEVE_SCALE : 1));
}

interface DrawerEntry {
  manifest: PatchOwner & { family: string };
  def: PatchDef;
  earned: boolean;
  gold: boolean;
}

function required<T extends Element>(found: T | null, what: string): T {
  if (!found) throw new Error(`The jacket screen is missing ${what}`);
  return found;
}

/** A filter chip pressed: "All" (value "undefined") clears its field, and so does pressing the chip that is already on. */
function toggledFilter(filter: DrawerFilter, key: string | undefined, raw: string): DrawerFilter {
  const kept: DrawerFilter = {};
  if (filter.game !== undefined) kept.game = filter.game;
  if (filter.family !== undefined && key !== 'family') kept.family = filter.family;
  if (filter.tier !== undefined && key !== 'tier') kept.tier = filter.tier;
  if (filter.gold !== undefined && key !== 'gold') kept.gold = filter.gold;
  if (raw === 'undefined') return kept;
  if (key === 'family' && filter.family !== raw) return { ...kept, family: raw };
  if (key === 'tier' && filter.tier !== raw) return { ...kept, tier: raw as PatchTier };
  if (key === 'gold' && filter.gold !== true) return { ...kept, gold: true };
  return kept;
}

export function createJacketView(options: { services: Services; onBack(): void }): JacketView {
  const { services } = options;
  const { repos, registry, denLife } = services;
  const manifests = [...registry.manifests].sort((a, b) => a.slot - b.slot);

  const history = createHistory<PatchPlacement[]>(repos.progress.get().den.jacket.placements);
  let side: JacketSide = 'front';
  let filter: DrawerFilter = {};
  /** The patch picked up with the keyboard, if any. */
  let held: string | null = null;

  repos.progress.update((draft) => {
    draft.den.jacket.lookedAt = new Date().toISOString();
  });

  const element = document.createElement('section');
  element.className = 'den-life-screen jacket-screen';
  element.setAttribute('aria-labelledby', 'jacket-title');
  element.innerHTML =
    `<header class="den-life-head">` +
    `<button type="button" class="button button--quiet" data-do="back">← Back to the Hall</button>` +
    `<div class="den-life-heading"><p class="den-life-kicker">The door</p><h1 id="jacket-title">Your jacket</h1></div>` +
    `<div class="den-life-tools" role="toolbar" aria-label="Jacket">` +
    `<div class="segmented" role="group" aria-label="Side"><button type="button" class="segment" data-side="front" aria-pressed="true">Front</button><button type="button" class="segment" data-side="back" aria-pressed="false">Back</button></div>` +
    `<button type="button" class="button" data-do="undo" aria-keyshortcuts="Control+Z">Undo</button>` +
    `<button type="button" class="button" data-do="redo" aria-keyshortcuts="Control+Y">Redo</button>` +
    `<button type="button" class="button" data-do="arrange">Auto-arrange</button>` +
    `<button type="button" class="button button--primary" data-do="export">Export card</button>` +
    `</div>` +
    `</header>` +
    `<div class="jacket-layout">` +
    `<figure class="jacket-stage">` +
    `<svg class="jacket-svg" viewBox="${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}" role="group" aria-labelledby="jacket-caption">` +
    `<defs>${jacketDefs()}<clipPath id="jacket-clip">${jacketOutline()}</clipPath></defs>` +
    `<g data-ref="cloth"></g>` +
    `<g data-ref="sewn"></g>` +
    `<g clip-path="url(#jacket-clip)" pointer-events="none">${jacketLight()}</g>` +
    `<circle class="jacket-held-ring" data-ref="held-ring" r="${PATCH_UNITS / 2 + 8}" cx="0" cy="0" hidden/>` +
    `</svg>` +
    `<figcaption id="jacket-caption" class="jacket-caption" data-ref="caption"></figcaption>` +
    `</figure>` +
    `<aside class="patch-drawer" aria-labelledby="drawer-title">` +
    `<div class="patch-drawer-head"><h2 id="drawer-title">Patch drawer</h2><p class="patch-drawer-help">Drag a patch onto the jacket, or press Enter on it to see it up close and sew it on. On the jacket: Enter picks a patch up, the arrows move it, R turns it, Enter sews it. Drop one back here to take it off.</p></div>` +
    `<div class="patch-filters" data-ref="filters"></div>` +
    `<ul class="patch-grid" data-ref="grid" role="list"></ul>` +
    `</aside>` +
    `</div>` +
    `<p class="sr-only" aria-live="polite" data-ref="announcer"></p>`;

  const svg = required(element.querySelector<SVGSVGElement>('.jacket-svg'), '.jacket-svg');
  const cloth = required(svg.querySelector<SVGGElement>('[data-ref="cloth"]'), '[data-ref="cloth"]');
  const sewnLayer = required(svg.querySelector<SVGGElement>('[data-ref="sewn"]'), '[data-ref="sewn"]');
  const heldRing = required(svg.querySelector<SVGCircleElement>('[data-ref="held-ring"]'), '[data-ref="held-ring"]');
  const caption = required(element.querySelector<HTMLElement>('[data-ref="caption"]'), '[data-ref="caption"]');
  const grid = required(element.querySelector<HTMLUListElement>('[data-ref="grid"]'), '[data-ref="grid"]');
  const filters = required(element.querySelector<HTMLDivElement>('[data-ref="filters"]'), '[data-ref="filters"]');
  const announcer = required(element.querySelector<HTMLParagraphElement>('[data-ref="announcer"]'), '[data-ref="announcer"]');
  const drawerElement = required(element.querySelector<HTMLElement>('.patch-drawer'), '.patch-drawer');

  const announce = (text: string) => {
    announcer.textContent = text;
  };

  // ——— What can be sewn ———
  const entries = (): DrawerEntry[] => {
    const progress = repos.progress.get();
    const champion = blockChampionStatus(progress);
    const den: DrawerEntry = { manifest: DEN_OWNER, def: BLOCK_CHAMPION, earned: champion.earned, gold: champion.gold };
    return [
      den,
      ...manifests.flatMap((manifest) =>
        denLife.patchesFor(manifest.id).map((def) => {
          const earned = progress.games[manifest.id]?.patches[def.id];
          return { manifest, def, earned: Boolean(earned?.earnedAt), gold: Boolean(earned?.gold) };
        }),
      ),
    ];
  };
  const drawer = (): DrawerPatch[] => earnedDrawer(manifests, (id) => denLife.patchesFor(id), repos.progress.get());
  const entryFor = (key: string) => entries().find((entry) => patchKey({ game: entry.manifest.id, patch: entry.def.id }) === key);
  const patchName = (key: string) => {
    const entry = entryFor(key);
    return entry ? `${entry.def.title} (${entry.manifest.title}, ${TIER_NAMES[entry.def.tier]})` : key;
  };

  const save = (placements: PatchPlacement[]) => {
    history.push(placements);
    repos.progress.update((draft) => {
      draft.den.jacket.placements = placements;
    });
    render();
  };

  const restore = (placements: PatchPlacement[]) => {
    // Keep focus on the patch it was on, if that patch is still on show.
    const focused = document.activeElement;
    const focusedKey = focused instanceof HTMLElement || focused instanceof SVGElement ? focused.dataset.key : undefined;
    repos.progress.update((draft) => {
      draft.den.jacket.placements = placements;
    });
    render();
    if (focusedKey) focusSewn(focusedKey);
  };

  // ——— Drawing ———
  const sewnMarkup = () =>
    [...history.current]
      .filter((placement) => placement.side === side)
      .sort((a, b) => a.z - b.z)
      .map((placement) => {
        const key = patchKey(placement);
        const entry = entryFor(key);
        if (!entry) return '';
        const size = drawnSize(entry.def.tier, placement);
        const art = patchImage({ manifest: entry.manifest, patchId: entry.def.id, tier: entry.def.tier, state: 'earned', gold: entry.gold }, 0, 0, size);
        return (
          `<g class="sewn-patch${held === key ? ' is-held' : ''}" data-key="${escapeXml(key)}" transform="translate(${placement.x} ${placement.y}) rotate(${placement.rotation})" tabindex="0" role="button" aria-label="${escapeXml(patchName(key))}, sewn">` +
          `<g transform="translate(${-size / 2} ${-size / 2})">${art}</g>` +
          `</g>`
        );
      })
      .join('');

  const filterMarkup = () => {
    const families = [...new Set(manifests.map((manifest) => manifest.family))];
    const chip = (label: string, key: keyof DrawerFilter, value: string | boolean | undefined) => {
      const pressed = filter[key] === value;
      return `<button type="button" class="chip-button" data-filter="${key}" data-value="${String(value)}" aria-pressed="${pressed}">${label}</button>`;
    };
    const gameOptions = manifests
      .filter((manifest) => denLife.patchesFor(manifest.id).length > 0)
      .map((manifest) => `<option value="${manifest.id}"${filter.game === manifest.id ? ' selected' : ''}>${escapeXml(manifest.title)}</option>`)
      .join('');
    return (
      `<label class="field field--inline"><span>Game</span><select data-ref="game-filter"><option value="">Every game</option>${gameOptions}</select></label>` +
      `<div class="chip-row" role="group" aria-label="Family">${chip('All', 'family', undefined)}${families.map((family) => chip(FAMILY_NAMES[family], 'family', family)).join('')}</div>` +
      `<div class="chip-row" role="group" aria-label="Tier">${chip('Any tier', 'tier', undefined)}${(['club', 'pro', 'legend', 'secret'] as const).map((tier) => chip(TIER_NAMES[tier], 'tier', tier)).join('')}${chip('Gold', 'gold', true)}</div>`
    );
  };

  const gridMarkup = () => {
    const placedKeys = new Set(history.current.map(patchKey));
    const shownEarned = new Set(filterDrawer(drawer(), filter).map(patchKey));
    return entries()
      .filter((entry) => {
        const key = patchKey({ game: entry.manifest.id, patch: entry.def.id });
        if (entry.earned) return shownEarned.has(key);
        if (filter.gold === true) return false;
        return (
          (filter.game === undefined || filter.game === entry.manifest.id) &&
          (filter.family === undefined || filter.family === entry.manifest.family) &&
          (filter.tier === undefined || filter.tier === entry.def.tier)
        );
      })
      .map((entry) => {
        const key = patchKey({ game: entry.manifest.id, patch: entry.def.id });
        const secret = entry.def.tier === 'secret' && !entry.earned;
        const state = entry.earned ? 'earned' : secret ? 'secret' : 'locked';
        const art = patchImg({ manifest: entry.manifest, patchId: entry.def.id, tier: entry.def.tier, state, gold: entry.gold }, 64);
        const title = secret ? '?' : entry.def.title;
        const note = entry.earned ? (placedKeys.has(key) ? 'On the jacket' : entry.gold ? 'Gold thread' : TIER_NAMES[entry.def.tier]) : secret ? (entry.def.hint ?? 'A secret') : entry.def.description;
        const sewn = placedKeys.has(key);
        // The tile is named by what it shows, with the game and tier for screen readers.
        const owner = `<span class="sr-only"> (${escapeXml(entry.manifest.title)}, ${TIER_NAMES[entry.def.tier]})</span>`;
        const body = `<span class="patch-tile-art" aria-hidden="true">${art}</span><span class="patch-tile-title">${escapeXml(secret ? 'Secret patch' : title)}</span>${owner}<span class="patch-tile-note">${escapeXml(note)}</span>`;
        return entry.earned
          ? `<li><button type="button" class="patch-tile${sewn ? ' is-sewn' : ''}${held === key ? ' is-held' : ''}" data-key="${escapeXml(key)}">${body}</button></li>`
          : `<li><button type="button" class="patch-tile is-locked" data-info="${escapeXml(key)}">${body}<span class="sr-only">, locked</span></button></li>`;
      })
      .join('');
  };

  const render = () => {
    cloth.innerHTML = jacketCloth(side);
    sewnLayer.innerHTML = sewnMarkup();
    const placements = history.current;
    const goldCount = placements.filter((placement) => entryFor(patchKey(placement))?.gold).length;
    const waiting = unsewn(drawer(), placements).length;
    caption.textContent = `${placements.length} ${placements.length === 1 ? 'patch' : 'patches'} sewn${goldCount ? `, ${goldCount} in gold thread` : ''}${waiting ? ` · ${waiting} in the drawer` : ''}. Showing the ${side}.`;
    filters.innerHTML = filterMarkup();
    grid.innerHTML = gridMarkup();
    for (const button of element.querySelectorAll<HTMLButtonElement>('.segment')) button.setAttribute('aria-pressed', String(button.dataset.side === side));
    required(element.querySelector<HTMLButtonElement>('[data-do="undo"]'), '[data-do="undo"]').setAttribute('aria-disabled', String(!history.canUndo));
    required(element.querySelector<HTMLButtonElement>('[data-do="redo"]'), '[data-do="redo"]').setAttribute('aria-disabled', String(!history.canRedo));
    const heldPlacement = held ? placements.find((placement) => patchKey(placement) === held && placement.side === side) : undefined;
    heldRing.toggleAttribute('hidden', !heldPlacement);
    heldRing.setAttribute('cx', String(heldPlacement?.x ?? 0));
    heldRing.setAttribute('cy', String(heldPlacement?.y ?? 0));
  };

  // ——— Pointer: drag from the drawer or the jacket ———
  const toJacket = (clientX: number, clientY: number) => {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: local.x, y: local.y };
  };
  const overJacket = (clientX: number, clientY: number) => {
    const box = svg.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  };
  const overDrawer = (clientX: number, clientY: number) => {
    const box = drawerElement.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  };

  let drag: { key: string; ghost: HTMLElement; startX: number; startY: number; moved: boolean } | null = null;

  const beginDrag = (key: string, event: PointerEvent) => {
    const entry = entryFor(key);
    if (!entry) return;
    const ghost = document.createElement('div');
    ghost.className = 'patch-ghost';
    ghost.innerHTML = patchArt({ manifest: entry.manifest, patchId: entry.def.id, tier: entry.def.tier, state: 'earned', gold: entry.gold }, 96, 'ghost');
    ghost.hidden = true;
    document.body.append(ghost);
    drag = { key, ghost, startX: event.clientX, startY: event.clientY, moved: false };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    drag.ghost.hidden = false;
    // The ghost is drawn at the jacket's scale so the drop looks the way it will land.
    const scale = svg.getBoundingClientRect().width / VIEW_BOX.width;
    drag.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%) scale(${n((PATCH_UNITS * scale) / 96)})`;
    element.classList.toggle('is-dropping-off', overDrawer(event.clientX, event.clientY));
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!drag) return;
    const { key, ghost, moved } = drag;
    ghost.remove();
    drag = null;
    element.classList.remove('is-dropping-off');
    if (!moved) {
      showUpClose(key);
      return;
    }
    const [game = '', patch = ''] = key.split('/');
    if (overJacket(event.clientX, event.clientY)) {
      const { x, y } = toJacket(event.clientX, event.clientY);
      const result = dropPatch(history.current, { game, patch }, side, x, y);
      if (result.reason) return refuse(result.reason);
      save(result.placements);
      announce(`${patchName(key)} sewn on the ${side}`);
    } else if (overDrawer(event.clientX, event.clientY) && history.current.some((placement) => patchKey(placement) === key)) {
      save(removePatch(history.current, key));
      announce(`${patchName(key)} back in the drawer`);
    }
  };

  /** Not allowed: a small shake and one line why, never a dialog. */
  const refuse = (reason: string) => {
    svg.classList.remove('is-refusing');
    void svg.getBoundingClientRect();
    svg.classList.add('is-refusing');
    toast(reason);
    announce(reason);
  };

  element.addEventListener('pointerdown', (event) => {
    const target = (event.target as Element).closest<HTMLElement | SVGGElement>('[data-key]');
    if (!target?.dataset.key || event.button !== 0) return;
    event.preventDefault();
    beginDrag(target.dataset.key, event);
  });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // ——— Keyboard: pick up, move, turn, sew ———
  const pickUp = (key: string) => {
    held = key;
    const onJacket = history.current.find((placement) => patchKey(placement) === key);
    if (onJacket) {
      side = onJacket.side;
    } else {
      // From the drawer, it goes to the nearest free spot to the middle of the side on show.
      const result = dropPatch(history.current, keyParts(key), side, 300, 360);
      if (result.reason) {
        held = null;
        return refuse(result.reason);
      }
      save(result.placements);
    }
    render();
    focusSewn(key);
    announce(`${patchName(key)} picked up. Arrows move it, R turns it, Enter sews it, Delete takes it off.`);
  };
  const keyParts = (key: string) => {
    const [game = '', patch = ''] = key.split('/');
    return { game, patch };
  };
  const focusSewn = (key: string) => {
    sewnLayer.querySelector<SVGGElement>(`[data-key="${CSS.escape(key)}"]`)?.focus();
  };

  // Undo and redo work wherever focus is on the screen, even after a redraw has taken it away.
  const onUndoKeys = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || document.querySelector('.dialog-backdrop')) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    if (key === 'y' || event.shiftKey) redo();
    else undo();
  };
  window.addEventListener('keydown', onUndoKeys);

  element.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    const target = (event.target as Element).closest<HTMLElement | SVGGElement>('[data-key]');
    const key = target?.dataset.key;
    if (!key) return;
    // In the drawer, Enter shows the patch up close, with the button that sews it on.
    if ((event.key === 'Enter' || event.key === ' ') && target instanceof HTMLElement) {
      event.preventDefault();
      showUpClose(key);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (held === key) {
        held = null;
        render();
        focusSewn(key);
        announce(`${patchName(key)} sewn`);
      } else {
        pickUp(key);
      }
      return;
    }
    if (held !== key) return;
    const arrows: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const direction = arrows[event.key];
    if (direction) {
      event.preventDefault();
      save(nudgePatch(history.current, key, direction));
      focusSewn(key);
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      save(rotatePatch(history.current, key, event.shiftKey ? -1 : 1));
      focusSewn(key);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      held = null;
      save(removePatch(history.current, key));
      announce(`${patchName(key)} back in the drawer`);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      held = null;
      render();
    }
  });

  // ——— Up close ———
  const showUpClose = (key: string) => {
    const entry = entryFor(key);
    if (!entry) return;
    const sewn = history.current.some((placement) => patchKey(placement) === key);
    const actions = !entry.earned
      ? []
      : sewn
        ? [
            { label: 'Move it', primary: true, run: () => pickUp(key) },
            {
              label: 'Take it off',
              run: () => {
                held = null;
                save(removePatch(history.current, key));
                announce(`${patchName(key)} back in the drawer`);
              },
            },
          ]
        : [{ label: `Sew it on the ${side}`, primary: true, run: () => pickUp(key) }];
    const status = entry.manifest.id === DEN_OWNER.id ? blockChampionStatus(repos.progress.get()) : undefined;
    openPatchPopover({ services, manifest: entry.manifest, def: entry.def, actions, ...(status ? { status } : {}) });
  };

  // ——— Toolbar and filters ———
  const undo = () => {
    if (!history.canUndo) return;
    restore(history.undo());
    announce('Undone');
  };
  const redo = () => {
    if (!history.canRedo) return;
    restore(history.redo());
    announce('Redone');
  };

  const exportCard = () => {
    const name = repos.profile.get().displayName;
    const withName = services.settings.get().shareWithName && name.trim() !== '';
    const svgText = jacketCard(history.current, withName ? name : null);
    downloadText('woodgrain-88-jacket.svg', svgText, 'image/svg+xml');
    void copyText(svgText).then((copied) => toast(copied ? 'Jacket card saved and copied' : 'Jacket card saved'));
  };

  /** A standalone picture of both sides, for sharing; no ids clash with the page because it is its own file. */
  const jacketCard = (placements: readonly PatchPlacement[], name: string | null) => {
    const sideMarkup = (which: JacketSide, offsetX: number) =>
      `<g transform="translate(${offsetX} 70)">` +
      `<clipPath id="card-clip-${which}">${jacketOutline()}</clipPath>` +
      jacketCloth(which) +
      placements
        .filter((placement) => placement.side === which)
        .sort((a, b) => a.z - b.z)
        .map((placement) => {
          const entry = entryFor(patchKey(placement));
          if (!entry) return '';
          const size = drawnSize(entry.def.tier, placement);
          const art = patchArt({ manifest: entry.manifest, patchId: entry.def.id, tier: entry.def.tier, state: 'earned', gold: entry.gold }, size, 'card');
          return `<g transform="translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(${-size / 2} ${-size / 2})">${art}</g>`;
        })
        .join('') +
      `</g>`;
    const title = name ? `${escapeXml(name)}'s jacket` : 'My jacket';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 860" width="1320" height="860">` +
      `<style>:root{--jacket-denim:#3f6b9c;--jacket-denim-dark:#2b4e78;--jacket-thread:#e0a14a;--jacket-seam:rgba(0,0,0,.28);--jacket-lining:#1c2c44}</style>` +
      `<defs>${jacketDefs()}</defs>` +
      `<rect width="1320" height="860" fill="#f3e6cc"/>` +
      `<text x="60" y="56" font-family="Georgia, serif" font-size="36" font-weight="700" fill="#2a1b12">${title}</text>` +
      `<text x="1260" y="56" text-anchor="end" font-family="Georgia, serif" font-size="20" fill="#5a4232">Woodgrain '88 · ${placements.length} patches</text>` +
      sideMarkup('front', 40) +
      sideMarkup('back', 680) +
      `</svg>`
    );
  };

  element.addEventListener('click', (event) => {
    const target = event.target as Element;
    const action = target.closest<HTMLElement>('[data-do]')?.dataset.do;
    if (action === 'back') options.onBack();
    if (action === 'undo') undo();
    if (action === 'redo') redo();
    if (action === 'arrange') {
      held = null;
      save(autoArrange(drawer()));
      announce('Every patch arranged');
    }
    if (action === 'export') exportCard();
    const info = target.closest<HTMLElement>('[data-info]')?.dataset.info;
    if (info) showUpClose(info);
    const sideButton = target.closest<HTMLElement>('[data-side]');
    if (sideButton?.dataset.side === 'front' || sideButton?.dataset.side === 'back') {
      side = sideButton.dataset.side;
      held = null;
      render();
    }
    const chip = target.closest<HTMLElement>('[data-filter]');
    if (chip) {
      const key = chip.dataset.filter;
      const raw = chip.dataset.value ?? 'undefined';
      filter = toggledFilter(filter, key, raw);
      render();
      element.querySelector<HTMLElement>(`[data-filter="${key ?? ''}"][data-value="${CSS.escape(raw)}"]`)?.focus();
    }
  });
  element.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.ref !== 'game-filter') return;
    const next: DrawerFilter = { ...filter };
    delete next.game;
    if (select.value !== '') next.game = select.value;
    filter = next;
    render();
    required(element.querySelector<HTMLSelectElement>('[data-ref="game-filter"]'), '[data-ref="game-filter"]').focus();
  });

  render();

  return {
    element,
    dispose() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onUndoKeys);
      drag?.ghost.remove();
      element.remove();
    },
  };
}
