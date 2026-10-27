/**
 * One accessible dialog for every overlay in the Hall (settings, details,
 * pause menu, results, confirmations): a labelled modal that traps focus,
 * closes on Escape when allowed, gives focus back to whatever opened it, and
 * hides the page behind it from assistive technology while it is open.
 */
import { escapeXml } from '../den/svg.ts';

export interface DialogOptions {
  /** Shown as the dialog's heading and used as its accessible name. */
  title: string;
  /** Visually hide the heading (it still names the dialog). */
  hideTitle?: boolean;
  className?: string;
  /** Escape and the backdrop close it. Default true. */
  dismissible?: boolean;
  /** Show a × button in the corner (for pointer and touch users). */
  closeButton?: boolean;
  onClose?(): void;
}

export interface Dialog {
  readonly element: HTMLElement;
  readonly body: HTMLElement;
  close(): void;
  readonly open: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;
let counter = 0;

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true',
  );
}

export function openDialog(options: DialogOptions): Dialog {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const id = `dialog-${++counter}`;
  const dismissible = options.dismissible ?? true;

  const element = document.createElement('div');
  element.className = `dialog-backdrop ${options.className ?? ''}`.trim();
  element.innerHTML =
    `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title">` +
    `<h2 id="${id}-title" class="dialog-title${options.hideTitle ? ' sr-only' : ''}">${escapeXml(options.title)}</h2>` +
    (options.closeButton
      ? `<button type="button" class="dialog-close" aria-label="Close">×</button>`
      : '') +
    `<div class="dialog-body"></div>` +
    `</section>`;
  const dialogElement = element.querySelector<HTMLElement>('.dialog');
  const body = element.querySelector<HTMLElement>('.dialog-body');
  if (!dialogElement || !body) throw new Error('Dialog markup is missing its parts');

  const app = document.getElementById('app');
  let isOpen = true;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(dialogElement);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  element.addEventListener('keydown', onKeyDown);
  element.addEventListener('pointerdown', (event) => {
    if (dismissible && event.target === element) dialog.close();
  });
  element.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());

  document.body.append(element);
  openCount++;
  app?.setAttribute('aria-hidden', 'true');
  app?.setAttribute('inert', '');

  const dialog: Dialog = {
    element,
    body,
    get open() {
      return isOpen;
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      element.remove();
      openCount--;
      if (openCount === 0) {
        app?.removeAttribute('aria-hidden');
        app?.removeAttribute('inert');
      }
      opener?.focus();
      options.onClose?.();
    },
  };

  // Focus the first usable control once the caller has filled the body; the
  // close button is a fallback, not the place to start.
  queueMicrotask(() => {
    if (!isOpen) return;
    const preferred =
      dialogElement.querySelector<HTMLElement>('[data-autofocus]') ??
      focusables(dialogElement).find(
        (item) =>
          item.getAttribute('aria-disabled') !== 'true' && !item.classList.contains('dialog-close'),
      );
    (preferred ?? dialogElement).focus();
  });
  dialogElement.tabIndex = -1;
  return dialog;
}

/** Asks a yes/no question; resolves true when the player confirms. */
export function confirmDialog(options: {
  title: string;
  message: string;
  confirm: string;
  cancel?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const dialog = openDialog({
      title: options.title,
      className: 'dialog--confirm',
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    dialog.body.innerHTML =
      `<p class="dialog-text">${escapeXml(options.message)}</p>` +
      `<div class="dialog-actions">` +
      `<button type="button" class="button" data-answer="no">${escapeXml(options.cancel ?? 'Stay')}</button>` +
      `<button type="button" class="button button--primary" data-answer="yes">${escapeXml(options.confirm)}</button>` +
      `</div>`;
    dialog.body.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-answer]');
      if (!button) return;
      answered = true;
      resolve(button.dataset.answer === 'yes');
      dialog.close();
    });
  });
}

/** A short message in the corner that fades away by itself (patches, copied links). */
export function toast(message: string, options: { tone?: 'plain' | 'celebrate' } = {}): void {
  let shelf = document.querySelector<HTMLElement>('.toast-shelf');
  if (!shelf) {
    shelf = document.createElement('div');
    shelf.className = 'toast-shelf';
    shelf.setAttribute('role', 'status');
    shelf.setAttribute('aria-live', 'polite');
    document.body.append(shelf);
  }
  const item = document.createElement('p');
  item.className = `toast toast--${options.tone ?? 'plain'}`;
  item.textContent = message;
  shelf.append(item);
  setTimeout(() => item.classList.add('is-leaving'), 3200);
  setTimeout(() => item.remove(), 3700);
}
