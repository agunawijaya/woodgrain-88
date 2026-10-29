/**
 * Modal sheet overlay for Trailblaze: traps focus, centres a scrolling panel
 * over the arena, closes on Escape, backdrop click or the close button,
 * and restores focus to whatever held it when disposed.
 */
import { ensureScreenStyle, escapeText } from './style.ts';

export interface SheetOptions {
  readonly host: HTMLElement;
  /** The sheet's heading, also its accessible name. */
  readonly title: string;
  readonly onClose: () => void;
}

export interface Sheet {
  /** Where the sheet's own content goes. */
  readonly body: HTMLElement;
  dispose(): void;
}

const STYLE = /* css */ `
.tb-sheet {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: clamp(12px, 3vh, 32px);
  background: rgba(12, 10, 8, 0.65);
  box-sizing: border-box;
}

.tb-screens[data-appearance='dark'] .tb-sheet {
  background: rgba(0, 0, 0, 0.82);
}

.tb-sheet-panel {
  width: min(720px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.tb-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--tb-border);
  flex-shrink: 0;
}

.tb-sheet-title {
  margin: 0;
  font-size: clamp(24px, 3.6vh, 32px);
  color: var(--tb-text);
}

.tb-sheet-close {
  border-radius: 999px;
  padding: 0.35em 0.85em;
  min-height: 38px;
  font-size: clamp(13px, 1.7vh, 15px);
  background: transparent;
  color: var(--tb-text);
}

.tb-sheet-body {
  overflow-y: auto;
  padding: clamp(16px, 2.5vh, 24px);
  display: grid;
  gap: clamp(14px, 2vh, 20px);
}
`;

let sheetIdSequence = 0;

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hidden) return false;
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && Number.parseInt(tabIndex, 10) < 0) return false;
  return true;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(isFocusable);
}

/** A modal panel over the menu: focus is held inside, Escape and the close button call onClose. */
export function createSheet(options: SheetOptions): Sheet {
  ensureScreenStyle(options.host);

  const previousActive =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const root = document.createElement('div');
  root.className = 'tb-sheet';

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  sheetIdSequence++;
  const titleId = `tb-sheet-title-${sheetIdSequence}`;

  const dialog = document.createElement('div');
  dialog.className = 'tb-card tb-sheet-panel';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);

  dialog.innerHTML =
    `<header class="tb-sheet-header">` +
    `<h2 id="${titleId}" class="tb-display tb-sheet-title">${escapeText(options.title)}</h2>` +
    `<button type="button" class="tb-button tb-sheet-close" aria-label="Close">` +
    `<span>Close</span><span class="tb-key" aria-hidden="true">Esc</span></button>` +
    `</header>` +
    `<div class="tb-sheet-body"></div>`;

  root.append(dialog);
  options.host.append(root);

  const found = dialog.querySelector<HTMLElement>('.tb-sheet-body');
  if (!found) throw new Error('Sheet markup missing body element');
  const body: HTMLElement = found;
  const closeButton = dialog.querySelector<HTMLButtonElement>('.tb-sheet-close');
  if (!closeButton) throw new Error('Sheet markup missing close button');

  let disposed = false;

  function focusInitial(): void {
    if (disposed) return;
    const focusableInBody = getFocusableElements(body);
    const target = focusableInBody[0] ?? closeButton;
    target?.focus();
  }

  focusInitial();
  queueMicrotask(() => {
    if (disposed) return;
    if (document.activeElement === closeButton || !root.contains(document.activeElement)) {
      const focusableInBody = getFocusableElements(body);
      const target = focusableInBody[0];
      if (target) {
        target.focus();
      }
    }
  });

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      options.onClose();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (event.shiftKey) {
        if (currentIndex <= 0 || document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        if (
          currentIndex === -1 ||
          currentIndex >= focusable.length - 1 ||
          document.activeElement === last
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === root) {
      options.onClose();
    }
  }

  function handleCloseClick(): void {
    options.onClose();
  }

  root.addEventListener('keydown', handleKeyDown);
  root.addEventListener('click', handleBackdropClick);
  closeButton.addEventListener('click', handleCloseClick);

  return {
    body,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeEventListener('keydown', handleKeyDown);
      root.removeEventListener('click', handleBackdropClick);
      closeButton.removeEventListener('click', handleCloseClick);
      root.remove();
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    },
  };
}
