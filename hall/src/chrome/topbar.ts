/**
 * The bar across the top of every Hall page: the logo (a tiny woodgrain
 * console), your profile chip, today's Power Cycle, the two Den Life modes
 * (Power Cycle Run and Versus Night), the Den / list switch, and the
 * appearance, sound and settings buttons. Light / Dark / System lives
 * in settings; the sun-and-moon button here flips between day and night.
 */
import { canPlanRun, dailyNumber, powerCycleOfTheDay } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { escapeXml } from '../den/svg.ts';

export interface TopBar {
  readonly element: HTMLElement;
  setView(view: 'den' | 'list' | 'other'): void;
  dispose(): void;
}

export interface TopBarOptions {
  services: Services;
  onDen(): void;
  onList(): void;
  onSettings(): void;
  onProfile(): void;
}

const LOGO = `<svg viewBox="0 0 40 28" aria-hidden="true" class="topbar-logo-mark">
  <path d="M4 10h32l2 12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" fill="#2a211c"/>
  <path d="M3 18h34v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="#a8693c"/>
  <path d="M5 20.5c6-1 12 1 18-.3s9 0 12 .4" fill="none" stroke="#6b3f22" stroke-width="0.9"/>
  <rect x="15" y="4" width="10" height="8" rx="1.5" fill="#d2601a"/>
  <rect x="16.5" y="5.5" width="7" height="3" rx="0.6" fill="#ffd27a"/>
  <rect x="7" y="7" width="3" height="7" rx="1.5" fill="#e2dcd2"/>
  <circle cx="8.5" cy="7" r="2.4" fill="#d2551f"/>
</svg>`;

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>',
  soundOn:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  soundOff:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 5-1.9-.4a6.8 6.8 0 0 1-.7 1.6l1.1 1.6-1.7 1.7-1.6-1.1a6.8 6.8 0 0 1-1.6.7l-.4 1.9h-2.4l-.4-1.9a6.8 6.8 0 0 1-1.6-.7l-1.6 1.1-1.7-1.7 1.1-1.6a6.8 6.8 0 0 1-.7-1.6l-1.9-.4v-2.4l1.9-.4c.2-.6.4-1.1.7-1.6L5.9 6.6l1.7-1.7 1.6 1.1c.5-.3 1-.5 1.6-.7l.4-1.9h2.4l.4 1.9c.6.2 1.1.4 1.6.7l1.6-1.1 1.7 1.7-1.1 1.6c.3.5.5 1 .7 1.6l1.9.4Z" fill="currentColor"/></svg>',
};

function avatarDot(hue: number): string {
  return `<span class="topbar-avatar" style="--avatar-hue: ${hue}" aria-hidden="true"></span>`;
}

export function createTopBar(options: TopBarOptions): TopBar {
  const { services } = options;
  const element = document.createElement('header');
  element.className = 'topbar';
  const today = new Date();
  const pick = powerCycleOfTheDay(services.registry.manifests, today);

  const render = () => {
    const profile = services.profile.get();
    const appearance = services.settings.appearance();
    const muted = services.settings.get().muted;
    element.innerHTML =
      `<a class="topbar-logo" href="#/" aria-label="Woodgrain '88, back to the Den">${LOGO}<span class="topbar-logo-text">Woodgrain <em>'88</em></span></a>` +
      `<button type="button" class="topbar-chip" data-action="profile">${avatarDot(profile.avatar.hue)}<span>${escapeXml(profile.displayName)}</span></button>` +
      `<span class="topbar-chip topbar-chip--daily"><span class="topbar-chip-label">Power Cycle #${dailyNumber(today)}</span><strong>${pick ? escapeXml(pick.title) : 'first game soon'}</strong></span>` +
      `<nav class="topbar-modes" aria-label="Modes">` +
      `<a class="topbar-chip topbar-chip--mode" href="#/run"><span class="topbar-chip-label">Power Cycle Run</span><strong>${canPlanRun(services.denLife.runCandidates()) ? 'five games, 45 s' : 'opens with five games'}</strong></a>` +
      `<a class="topbar-chip topbar-chip--mode" href="#/versus"><span class="topbar-chip-label">Versus Night</span><strong>${services.versusNight.series() ? 'series on' : 'two players'}</strong></a>` +
      `</nav>` +
      `<span class="topbar-spacer"></span>` +
      `<nav class="topbar-links" aria-label="Pages"><a href="#/records">Records</a><a href="#/about">About</a></nav>` +
      `<div class="topbar-switch" role="group" aria-label="View">` +
      `<button type="button" data-action="den" aria-pressed="false">Den</button>` +
      `<button type="button" data-action="list" aria-pressed="false">List</button>` +
      `</div>` +
      `<button type="button" class="topbar-icon" data-action="appearance" aria-label="${appearance === 'dark' ? 'Switch to day' : 'Switch to night'}">${appearance === 'dark' ? ICONS.sun : ICONS.moon}</button>` +
      `<button type="button" class="topbar-icon" data-action="sound" aria-label="${muted ? 'Sound on' : 'Sound off'}" aria-pressed="${muted ? 'false' : 'true'}">${muted ? ICONS.soundOff : ICONS.soundOn}</button>` +
      `<button type="button" class="topbar-icon" data-action="settings" aria-label="Settings">${ICONS.gear}</button>`;
    applyView();
  };

  let view: 'den' | 'list' | 'other' = 'den';
  const applyView = () => {
    for (const button of element.querySelectorAll<HTMLButtonElement>('.topbar-switch button')) {
      button.setAttribute('aria-pressed', String(button.dataset.action === view));
    }
  };

  element.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    void services.audio.unlock();
    switch (button.dataset.action) {
      case 'den':
        options.onDen();
        break;
      case 'list':
        options.onList();
        break;
      case 'appearance': {
        const next = services.settings.appearance() === 'dark' ? 'light' : 'dark';
        services.settings.update((draft) => {
          draft.appearance = next;
        });
        break;
      }
      case 'sound':
        services.settings.update((draft) => {
          draft.muted = !draft.muted;
        });
        break;
      case 'settings':
        options.onSettings();
        break;
      case 'profile':
        options.onProfile();
        break;
    }
  });

  const stops = [
    services.settings.onChange(render),
    services.settings.onAppearance(render),
    services.repos.profile.onChange(render),
    services.versusNight.onChange(render),
  ];
  render();

  return {
    element,
    setView(next) {
      view = next;
      applyView();
    },
    dispose() {
      for (const stop of stops) stop();
      element.remove();
    },
  };
}
