/**
 * One patch up close: the embroidery at full size, what earns it, how far
 * along the player is, and whether it is sewn in gold. Opened from the patch
 * drawer, a patch on the jacket, or a game's details. A secret patch keeps
 * its secret until it is earned: only its hint shows.
 */
import { createPatchTracker, type PatchDef, type PatchTier } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { openDialog, type Dialog } from '../chrome/dialog.ts';
import { escapeXml } from '../den/svg.ts';
import { patchArt, type PatchOwner } from './patch-look.ts';

const TIER_LINES: Record<PatchTier, string> = {
  club: 'Club patch: the first goal in the game',
  pro: 'Pro patch: for players who keep coming back',
  legend: 'Legend patch: a trophy for the shelf too',
  secret: 'Secret patch',
};

export interface PatchPopoverAction {
  label: string;
  primary?: boolean;
  run(): void;
}

export function openPatchPopover(options: {
  services: Services;
  manifest: PatchOwner;
  def: PatchDef;
  /** For a patch no game tracks (the Den's own): how it stands. */
  status?: { earned: boolean; gold: boolean; earnedAt: string | null };
  actions?: readonly PatchPopoverAction[];
}): Dialog {
  const { services, manifest, def } = options;
  const tracker = createPatchTracker({
    games: [{ id: manifest.id, patches: services.denLife.patchesFor(manifest.id) }],
    progress: services.repos.progress,
  });
  const tracked = tracker.status(manifest.id).find((candidate) => candidate.def.id === def.id);
  const status =
    tracked ??
    (options.status
      ? {
          ...options.status,
          value: options.status.earned ? 1 : 0,
          target: 1,
          progress: options.status.earned ? 1 : 0,
        }
      : undefined);
  const earned = status?.earned ?? false;
  const gold = status?.gold ?? false;
  const hidden = def.tier === 'secret' && !earned;
  const title = hidden ? 'A secret patch' : def.title;
  const state = earned ? 'earned' : hidden ? 'secret' : 'locked';
  const dialog = openDialog({ title, className: 'dialog--patch', closeButton: true });

  const percent = Math.round((status?.progress ?? 0) * 100);
  const progress = earned
    ? `<p class="patch-pop-earned">Earned ${status?.earnedAt ? new Date(status.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}${gold ? ' · sewn in gold thread' : ''}</p>`
    : `<div class="patch-pop-progress"><div class="patch-pop-bar" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${status?.target ?? def.goal.target}" aria-valuenow="${status?.value ?? 0}"><span style="width: ${percent}%"></span></div><span>${(status?.value ?? 0).toLocaleString('en-GB')} / ${(status?.target ?? def.goal.target).toLocaleString('en-GB')}</span></div>`;
  const goldNote =
    earned && !gold
      ? `<p class="patch-pop-note">Meet the goal again with the left difficulty switch on A to sew it in gold thread.</p>`
      : '';
  dialog.body.innerHTML =
    `<div class="patch-pop">` +
    `<div class="patch-pop-art">${patchArt({ manifest, patchId: def.id, tier: def.tier, state, gold }, 180, 'popover')}</div>` +
    `<div class="patch-pop-text">` +
    `<p class="dialog-kicker">${escapeXml(manifest.title)} · ${escapeXml(TIER_LINES[def.tier])}</p>` +
    `<p class="patch-pop-goal">${escapeXml(hidden ? (def.hint ?? 'Keep playing to find it.') : def.description)}</p>` +
    progress +
    goldNote +
    (options.actions?.length
      ? `<div class="button-row">${options.actions.map((action, index) => `<button type="button" class="button${action.primary ? ' button--primary' : ''}" data-action="${index}">${escapeXml(action.label)}</button>`).join('')}</div>`
      : '') +
    `</div>` +
    `</div>`;
  dialog.body.addEventListener('click', (event) => {
    const index = (event.target as Element).closest<HTMLButtonElement>('[data-action]')?.dataset
      .action;
    const action = index === undefined ? undefined : options.actions?.[Number(index)];
    if (!action) return;
    dialog.close();
    action.run();
  });
  dialog.body.querySelector<HTMLButtonElement>('.button--primary')?.focus();
  return dialog;
}
