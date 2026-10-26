/**
 * The calendar's month view, opened from the wall calendar: one page per
 * month, days ticked off when anything was played, a snowflake where the
 * week's snow day covered a gap, today ringed, and the streak and the best
 * streak in the corner. Flip back to earlier months (PageUp or the arrow)
 * and forward again up to this month. Below the page, today's Power Cycle:
 * the game, its channel and whether it has been played.
 *
 * Gaps are just empty squares. Nothing here counts down or tells anyone off.
 */
import { calendarMonth, channelNumber, dailyChannel, dailyNumber, powerCycleOfTheDay, utcDateKey, type CalendarCell } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { openDialog, type Dialog } from '../chrome/dialog.ts';
import { escapeXml } from './svg.ts';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** How far back the pages go: a year is plenty for a wall calendar. */
const MONTHS_BACK = 12;

interface Page {
  year: number;
  /** 1–12. */
  month: number;
}

function shift(page: Page, months: number): Page {
  const index = page.year * 12 + (page.month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function cellLabel(cell: CalendarCell, monthName: string): string {
  const what = cell.kind === 'played' ? 'played' : cell.kind === 'snow' ? 'snow day' : cell.kind === 'future' ? 'still to come' : 'not played';
  return `${monthName} ${cell.day}: ${what}${cell.today ? ', today' : ''}`;
}

function cellMarkup(cell: CalendarCell, monthName: string): string {
  const mark =
    cell.kind === 'played'
      ? `<svg class="cal-tick" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 11l5 5L17 4"/></svg>`
      : cell.kind === 'snow'
        ? `<svg class="cal-flake" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v16M3 6l14 8M3 14l14-8M8 3l2 2 2-2M8 17l2-2 2 2"/></svg>`
        : '';
  return `<li class="cal-day cal-day--${cell.kind}${cell.today ? ' is-today' : ''}" aria-label="${escapeXml(cellLabel(cell, monthName))}"><span class="cal-number" aria-hidden="true">${cell.day}</span>${mark}</li>`;
}

export function openCalendar(options: { services: Services; onPlayDaily(gameId: string, channel: string): void; now?: Date }): Dialog {
  const { services } = options;
  const now = options.now ?? new Date();
  const thisMonth: Page = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  let page = thisMonth;

  const dialog = openDialog({ title: 'Calendar', className: 'dialog--calendar', closeButton: true, hideTitle: true });

  const today = () => {
    const pick = powerCycleOfTheDay(services.registry.manifests, now);
    const manifest = pick ? services.registry.manifests.find((candidate) => candidate.id === pick.id) : undefined;
    if (!manifest) return `<p class="cal-today">Daily #${dailyNumber(now)}: the first Power Cycle arrives with the first game.</p>`;
    const channel = dailyChannel(manifest, now);
    const played = services.repos.progress.get().den.daily[utcDateKey(now)]?.[manifest.id] !== undefined;
    return (
      `<div class="cal-today"><p><strong>Daily #${dailyNumber(now)}</strong> · today's Power Cycle is <strong>${escapeXml(manifest.title)}</strong>, channel ${channelNumber(manifest.channels, channel.id)} (${escapeXml(channel.title)}). ${played ? 'Played today.' : 'Not played yet today.'}</p>` +
      `<button type="button" class="button${played ? '' : ' button--primary'}" data-do="daily" data-game="${manifest.id}" data-channel="${channel.id}">${played ? 'Play it again (practice)' : "Play today's daily"}</button></div>`
    );
  };

  const render = () => {
    const streak = services.denLife.streak(now);
    const cells = calendarMonth(services.repos.progress.get().den.streak, page.year, page.month, now);
    const monthName = new Date(Date.UTC(page.year, page.month - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
    const offset = (new Date(Date.UTC(page.year, page.month - 1, 1)).getUTCDay() + 6) % 7;
    const earliest = shift(thisMonth, -MONTHS_BACK);
    const atStart = page.year * 12 + page.month <= earliest.year * 12 + earliest.month;
    const atNow = page.year === thisMonth.year && page.month === thisMonth.month;
    const played = cells.filter((cell) => cell.kind === 'played').length;
    dialog.body.innerHTML =
      `<div class="cal-page">` +
      `<div class="cal-photo" aria-hidden="true"><span class="cal-sun"></span><span class="cal-hills"></span></div>` +
      `<div class="cal-binding" aria-hidden="true"></div>` +
      `<header class="cal-head">` +
      `<button type="button" class="cal-flip" data-flip="-1" aria-label="Earlier month"${atStart ? ' disabled' : ''}>‹</button>` +
      `<h3 class="cal-month" aria-live="polite">${escapeXml(monthName)} <span>${page.year}</span></h3>` +
      `<button type="button" class="cal-flip" data-flip="1" aria-label="Later month"${atNow ? ' disabled' : ''}>›</button>` +
      `<p class="cal-sticker"><strong>${streak.current}</strong> ${streak.current === 1 ? 'day' : 'days'} in a row<span>best ${streak.best}</span></p>` +
      `</header>` +
      `<ol class="cal-weekdays" aria-hidden="true">${WEEKDAYS.map((day) => `<li>${day}</li>`).join('')}</ol>` +
      `<ol class="cal-grid" aria-label="${escapeXml(`${monthName} ${page.year}: ${played} ${played === 1 ? 'day' : 'days'} played`)}" style="--offset: ${offset}">${cells.map((cell) => cellMarkup(cell, monthName)).join('')}</ol>` +
      `<p class="cal-key"><span class="cal-key-tick">✓</span> played <span class="cal-key-flake">✻</span> snow day: one a week covers a missed day</p>` +
      `</div>` +
      today();
  };

  const flip = (months: number) => {
    const next = shift(page, months);
    const earliest = shift(thisMonth, -MONTHS_BACK);
    if (next.year * 12 + next.month > thisMonth.year * 12 + thisMonth.month) return;
    if (next.year * 12 + next.month < earliest.year * 12 + earliest.month) return;
    page = next;
    services.audio.play('soft-tap', { pitch: months < 0 ? 0.9 : 1.1 });
    render();
    dialog.body.querySelector<HTMLButtonElement>(`[data-flip="${months < 0 ? -1 : 1}"]:not([disabled])`)?.focus();
  };

  dialog.body.addEventListener('click', (event) => {
    const target = event.target as Element;
    const flipButton = target.closest<HTMLButtonElement>('[data-flip]');
    if (flipButton) flip(Number(flipButton.dataset.flip));
    const daily = target.closest<HTMLButtonElement>('[data-do="daily"]');
    if (daily?.dataset.game && daily.dataset.channel) {
      dialog.close();
      options.onPlayDaily(daily.dataset.game, daily.dataset.channel);
    }
  });
  dialog.element.addEventListener('keydown', (event) => {
    if (event.key === 'PageUp') {
      event.preventDefault();
      flip(-1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      flip(1);
    }
  });
  render();
  dialog.body.querySelector<HTMLButtonElement>('[data-flip="-1"]')?.focus();
  return dialog;
}
