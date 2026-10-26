/**
 * Starts the Hall: services, the live appearance on <html>, the top bar, and
 * the router that swaps between The Den, the Label Wall list, a game, the
 * Records and About pages and Den Life's screens. The real site and the test
 * harness both boot through here; only the harness passes registry
 * overrides, and only the dev showcase passes services of its own.
 */
import { VERSION_SETTING, type GameEntry, type GameManifest } from '@woodgrain-88/kit';
import { openDetails } from '../chrome/details.ts';
import type { Dialog } from '../chrome/dialog.ts';
import { openProfilePanel, openShortcuts } from '../chrome/profile-panel.ts';
import { openSettingsPanel } from '../chrome/settings-panel.ts';
import { createTopBar } from '../chrome/topbar.ts';
import { openCalendar } from '../den/calendar-view.ts';
import { createDenView, type DenView } from '../den/den-view.ts';
import { createJacketView } from '../jacket/jacket-view.ts';
import { createKidsView } from '../kids/kids-view.ts';
import { createVersusView } from '../versus/versus-view.ts';
import { createListView, type ListView } from '../list/list-view.ts';
import { createAboutPage, type AboutPage } from '../pages/about.ts';
import { createRecordsPage, type RecordsPage } from '../pages/records.ts';
import { runFromParams } from '../play/run-info.ts';
import { startPlaySession, type PlaySession } from '../play/session.ts';
import { createRouter, type Route } from '../routes/router.ts';
import { createRunOverlay, type RunOverlay } from '../run/run-overlay.ts';
import { createServices } from './services.ts';

const NARROW_QUERY = '(max-width: 900px)';

interface Page {
  element: HTMLElement;
  dispose(): void;
}

export function boot(root: HTMLElement, overrides: readonly GameEntry[] = [], services = createServices(overrides)): void {
  const { settings } = services;
  // Patches and micro-challenges of every playable game, for growth, the jacket and the run.
  void services.denLife.loadGameData();
  const html = document.documentElement;
  const applyAppearance = () => {
    html.dataset.appearance = settings.appearance();
    html.dataset.motion = settings.reducedMotion() ? 'reduced' : 'full';
  };
  applyAppearance();
  settings.onAppearance(applyAppearance);
  settings.onReducedMotion(applyAppearance);

  const shell = document.createElement('div');
  shell.className = 'shell';
  const viewHost = document.createElement('main');
  viewHost.className = 'view';
  shell.append(viewHost);
  root.append(shell);

  let den: DenView | null = null;
  let list: ListView | null = null;
  let page: (RecordsPage | AboutPage | Page) | null = null;
  let session: PlaySession | null = null;
  let run: RunOverlay | null = null;
  let details: Dialog | null = null;
  let currentHash = location.hash || '#/';
  let restoring = false;
  let backgroundHash = '#/';

  const router = createRouter((route) => void handle(route));

  // From inside a game the panel also shows that game's own settings.
  const openSettings = (game?: GameManifest) =>
    openSettingsPanel({
      services,
      ...(game ? { game } : {}),
      onReplayIntro: () => {
        router.go({ name: 'den' });
        void replayIntro();
      },
    });

  const topbar = createTopBar({
    services,
    onDen: () => router.go({ name: 'den' }),
    onList: () => router.go({ name: 'list' }),
    onSettings: () => openSettings(),
    onProfile: () => openProfilePanel(services),
  });
  shell.prepend(topbar.element);

  const goToGame = (id: string, version?: string) =>
    router.go(version ? { name: 'game', id, version } : { name: 'game', id });
  // Straight into play on a channel the dial picked.
  const playChannel = (id: string, version: string | undefined, channel: string) =>
    router.go({ name: 'play', id, params: new URLSearchParams({ ch: channel, ...(version ? { version } : {}) }) });

  const clearViews = (keep: 'den' | 'list' | 'none') => {
    if (keep !== 'den') {
      den?.dispose();
      den = null;
    }
    if (keep !== 'list') {
      list?.dispose();
      list = null;
    }
    page?.dispose();
    page = null;
  };

  const showDen = () => {
    clearViews('den');
    if (!den) {
      den = createDenView({
        services,
        onOpenGame: goToGame,
        onOpenList: () => router.go({ name: 'list' }),
        onShowShortcuts: openShortcuts,
        onOpenJacket: () => router.go({ name: 'jacket' }),
        onOpenKids: () => router.go({ name: 'kids' }),
        onOpenVersus: () => router.go({ name: 'versus' }),
        onStartRun: () => router.go({ name: 'run' }),
        onOpenCalendar: () =>
          openCalendar({
            services,
            onPlayDaily: (id, channel) => router.go({ name: 'play', id, params: new URLSearchParams({ mode: 'daily', ch: channel }) }),
          }),
      });
      viewHost.append(den.element);
    }
    den.resume();
    topbar.setView('den');
    backgroundHash = '#/';
  };

  const showList = () => {
    clearViews('list');
    if (!list) {
      list = createListView({ manifests: services.registry.manifests, onOpenGame: goToGame });
      viewHost.append(list.element);
    }
    topbar.setView('list');
    backgroundHash = '#/list';
  };

  const showPage = (create: () => Page) => {
    clearViews('none');
    page = create();
    viewHost.append(page.element);
    topbar.setView('other');
  };

  const replayIntro = async () => {
    await Promise.resolve();
    await den?.playIntro();
  };

  const endSession = () => {
    session?.dispose();
    session = null;
    shell.classList.remove('is-playing');
  };

  const startGame = async (id: string, route: Route) => {
    const entry = services.registry.entryById(id);
    if (!entry) {
      router.go({ name: 'den' }, { replace: true });
      return;
    }
    if (!entry.load) {
      if (!den && !list) showDen();
      details?.close();
      details = openDetails({
        services,
        entry,
        ...(route.name === 'game' && route.version ? { version: route.version } : {}),
        onPlay: (id, version, channel) => (channel ? playChannel(id, version, channel) : goToGame(id, version)),
        onClose: () => {
          details = null;
          if (location.hash.startsWith(`#/game/${id}`) || location.hash.startsWith(`#/play/${id}`)) {
            router.go(backgroundHash === '#/list' ? { name: 'list' } : { name: 'den' }, { replace: true });
          }
        },
      });
      return;
    }
    clearViews('none');
    endSession();
    shell.classList.add('is-playing');
    const params =
      route.name === 'play'
        ? route.params
        : new URLSearchParams(route.name === 'game' && route.version ? { version: route.version } : {});
    const savedVersion = services.settings.game(id).get<string | undefined>(VERSION_SETTING, undefined);
    session = await startPlaySession({
      services,
      entry,
      run: runFromParams(entry.manifest, params, location.hash, new Date(), savedVersion),
      micro: params.get('micro'),
      onBackToHall: () => router.go({ name: 'den' }),
      onRoundOver: () => router.go({ name: 'run' }),
      onBackToVersus: () => router.go({ name: 'versus' }),
      onSwitchChannel: (channel) => playChannel(id, route.name === 'play' ? (route.params.get('version') ?? undefined) : undefined, channel),
      onOpenSettings: () => openSettings(entry.manifest),
    });
    viewHost.append(session.element);
  };

  async function handle(route: Route) {
    if (restoring) {
      restoring = false;
      return;
    }
    // Leaving a running game asks first, even through the browser's Back button.
    if (session && route.name !== 'game' && route.name !== 'play') {
      const ok = await session.confirmLeave();
      if (!ok) {
        restoring = true;
        location.hash = currentHash;
        return;
      }
      endSession();
    }
    currentHash = location.hash || '#/';
    // Details live at #/game/<id>; any other route (Back included) closes them.
    details?.close();
    if (route.name !== 'run') {
      run?.dispose();
      run = null;
    }
    switch (route.name) {
      case 'den':
        showDen();
        if (!settings.get().introSeen) void replayIntro();
        break;
      case 'list':
        showList();
        break;
      case 'run':
        showDen();
        if (den && !run) {
          run = createRunOverlay({
            services,
            den,
            onPlayRound: (round) =>
              router.go({
                name: 'play',
                id: round.game,
                params: new URLSearchParams({ mode: 'power-cycle-run', micro: round.challenge.id, ch: round.challenge.channel }),
              }),
            onExit: () => router.go({ name: 'den' }),
          });
        }
        break;
      case 'jacket':
        showPage(() => createJacketView({ services, onBack: () => router.go({ name: 'den' }) }));
        break;
      case 'kids':
        showPage(() => createKidsView({ services, onBack: () => router.go({ name: 'den' }) }));
        break;
      case 'versus':
        showPage(() =>
          createVersusView({
            services,
            onBack: () => router.go({ name: 'den' }),
            onPlay: (id) => router.go({ name: 'play', id, params: new URLSearchParams({ mode: 'versus-night' }) }),
          }),
        );
        break;
      case 'records':
        showPage(() => createRecordsPage({ services, onOpenSettings: openSettings }));
        break;
      case 'about':
        showPage(() =>
          createAboutPage({
            manifests: services.registry.manifests,
            onReplayIntro: () => {
              router.go({ name: 'den' });
              void replayIntro();
            },
          }),
        );
        break;
      case 'game':
      case 'play':
        await startGame(route.id, route);
        break;
      case 'not-found':
        router.go({ name: 'den' }, { replace: true });
        break;
    }
  }

  const initial = router.current();
  if (initial.name === 'den' && matchMedia(NARROW_QUERY).matches && location.hash === '') {
    router.go({ name: 'list' }, { replace: true });
  } else {
    void handle(initial);
  }
}
