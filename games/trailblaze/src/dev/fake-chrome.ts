/**
 * Dev-only fake chrome: provides a miniature replica of the Hall's play chrome
 * with the standard navigation controls and pause menu ordering.
 */
import type { GameView, PauseItem } from '@woodgrain-88/kit';

export interface FakeChrome {
  showView(view: GameView): void;
  openPause(): void;
  dispose(): void;
}

export interface FakeChromeOptions {
  readonly host: HTMLElement;
  readonly pauseItems: () => readonly PauseItem[];
  onResume(): void;
  onGameMenu(): void;
  onBackToHall(): void;
  onHowToPlay(): void;
  onSettings(): void;
  readonly onPause?: () => void;
}

const BUTTON_BASE_STYLE =
  'min-height: 44px; padding: 0 16px; border-radius: 8px; font-family: system-ui, sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; text-align: center; box-sizing: border-box;';

const PAUSE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="display: block;"><rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/></svg>';

export function createFakeChrome(options: FakeChromeOptions): FakeChrome {
  const chromeRoot = document.createElement('div');
  chromeRoot.className = 'fake-chrome-root';
  chromeRoot.style.cssText =
    'position: absolute; inset: 0; pointer-events: none; z-index: 20; font-family: system-ui, -apple-system, sans-serif;';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'fake-chrome-back';
  backButton.textContent = '← Back to the Hall';
  backButton.style.cssText =
    'position: absolute; top: 16px; left: 16px; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid #555; background: #1e1e1e; color: #fff; cursor: pointer; font-size: 14px; font-weight: 600; pointer-events: auto; display: block;';
  backButton.addEventListener('click', () => {
    options.onBackToHall();
  });

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'fake-chrome-pause';
  pauseButton.setAttribute('aria-label', 'Pause (Esc)');
  pauseButton.style.cssText =
    'position: absolute; top: 16px; right: 16px; height: 44px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid #555; background: #1e1e1e; color: #fff; cursor: pointer; font-size: 14px; font-weight: 600; pointer-events: auto; display: none; align-items: center; gap: 8px;';
  pauseButton.innerHTML = `${PAUSE_ICON_SVG}<span style="font-size: 12px; padding: 2px 6px; border-radius: 4px; background: #333; border: 1px solid #555;">Esc</span>`;

  chromeRoot.append(backButton, pauseButton);
  options.host.append(chromeRoot);

  let overlay: HTMLElement | null = null;
  let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

  function closePause(): void {
    if (escapeHandler !== null) {
      window.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
    if (overlay !== null) {
      overlay.remove();
      overlay = null;
    }
  }

  function openPause(): void {
    if (overlay !== null) {
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'fake-chrome-backdrop';
    backdrop.style.cssText =
      'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: grid; place-items: center; z-index: 100; pointer-events: auto;';

    const dialog = document.createElement('div');
    dialog.className = 'fake-chrome-dialog';
    dialog.style.cssText =
      'background: #222; color: #fff; border-radius: 12px; border: 1px solid #444; padding: 24px; width: min(380px, calc(100vw - 32px)); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;';

    const title = document.createElement('h2');
    title.textContent = 'Paused';
    title.style.cssText = 'margin: 0 0 6px; font-size: 20px; font-weight: 700; text-align: center;';
    dialog.append(title);

    const resumeBtn = document.createElement('button');
    resumeBtn.type = 'button';
    resumeBtn.textContent = 'Resume';
    resumeBtn.style.cssText = `${BUTTON_BASE_STYLE} border: 1px solid #2e7d32; background: #2e7d32; color: #fff;`;
    resumeBtn.addEventListener('click', () => {
      closePause();
      options.onResume();
    });
    dialog.append(resumeBtn);

    const items = options.pauseItems();
    for (const item of items) {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.textContent = item.label;
      itemBtn.style.cssText = `${BUTTON_BASE_STYLE} border: 1px solid #555; background: #333; color: #fff;`;
      itemBtn.addEventListener('click', () => {
        item.onSelect();
      });
      dialog.append(itemBtn);
    }

    const howBtn = document.createElement('button');
    howBtn.type = 'button';
    howBtn.textContent = 'How to play';
    howBtn.style.cssText = `${BUTTON_BASE_STYLE} border: 1px solid #555; background: #333; color: #fff;`;
    howBtn.addEventListener('click', () => {
      options.onHowToPlay();
    });
    dialog.append(howBtn);

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.textContent = 'Settings';
    settingsBtn.style.cssText = `${BUTTON_BASE_STYLE} border: 1px solid #555; background: #333; color: #fff;`;
    settingsBtn.addEventListener('click', () => {
      options.onSettings();
    });
    dialog.append(settingsBtn);

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.textContent = 'Game menu';
    menuBtn.style.cssText = `${BUTTON_BASE_STYLE} border: 1px solid #555; background: #333; color: #fff;`;
    menuBtn.addEventListener('click', () => {
      closePause();
      options.onGameMenu();
    });
    dialog.append(menuBtn);

    const hallBtn = document.createElement('button');
    hallBtn.type = 'button';
    hallBtn.textContent = 'Back to the Hall';
    hallBtn.style.cssText = `${BUTTON_BASE_STYLE} border: 1px solid #555; background: #333; color: #fff;`;
    hallBtn.addEventListener('click', () => {
      closePause();
      options.onBackToHall();
    });
    dialog.append(hallBtn);

    backdrop.append(dialog);
    options.host.append(backdrop);
    overlay = backdrop;

    escapeHandler = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePause();
        options.onResume();
      }
    };
    window.addEventListener('keydown', escapeHandler);
  }

  pauseButton.addEventListener('click', () => {
    options.onPause?.();
    openPause();
  });

  return {
    showView(view: GameView): void {
      if (view === 'menu') {
        backButton.style.display = 'block';
        pauseButton.style.display = 'none';
      } else if (view === 'play') {
        backButton.style.display = 'none';
        pauseButton.style.display = 'inline-flex';
      } else {
        backButton.style.display = 'none';
        pauseButton.style.display = 'none';
      }
    },
    openPause,
    dispose(): void {
      closePause();
      chromeRoot.remove();
    },
  };
}
