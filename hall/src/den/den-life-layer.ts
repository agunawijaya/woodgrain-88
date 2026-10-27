/**
 * Den Life in the room: fills the scene's empty slots from what the player
 * has done. The growth items (posters, trophies, lights, the second beanbag
 * and the rest), the Polaroids on the corkboard, the score on the chalkboard,
 * the patches on the door jacket, and the calendar's page with today's daily
 * and the streak ticked off.
 *
 * Each slot is rewritten only when its markup changes, so a stats update
 * does not repaint the whole room. Items earned since the player last looked
 * fade in with a sparkle, but only while the Den is on screen: earning a
 * trophy mid-game waits for the walk back to the Den. The same goes for the
 * Counter's one-time celebration when all 32 lamps are lit: the lamps chase
 * round and its mechanical bell rings.
 */
import {
  blockLadder,
  calendarMonth,
  channelNumber,
  dailyChannel,
  dailyNumber,
  powerCycleOfTheDay,
  utcDateKey,
  type CalendarCell,
  type KidId,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { toast } from '../chrome/dialog.ts';
import { BLOCK_CHAMPION, DEN_OWNER } from '../jacket/den-patches.ts';
import { patchImage } from '../jacket/patch-look.ts';
import { calendarName } from './calendar-name.ts';
import { cat } from './cat.ts';
import { denChalkboard, type ChalkboardScore } from './chalkboard.ts';
import { corkboard } from './corkboard.ts';
import { COUNTER_SLOTS } from '../data/cycle.ts';
import { LAYOUT } from './geometry.ts';
import type { GrowthItem } from './growth.ts';
import {
  onAirGlow,
  onAirSign,
  paperChain,
  plaque,
  posters,
  remote,
  stringLights,
  stringLightsGlow,
  trophies,
} from './growth-art.ts';
import { beanbag, CALENDAR_PHOTO_HEIGHT, TEAL_BEANBAG } from './room.ts';
import { n } from './svg.ts';

/** Curled up in the second beanbag's dent once it arrives. */
const CAT_ON_SECOND_BEANBAG = { x: 1468, y: 742, width: 124 };

/** The door jacket is the Jacket screen's 600×700 drawing, hung up and seen from across the room. */
const DOOR_JACKET = {
  centreX: LAYOUT.jacket.x + LAYOUT.jacket.width / 2,
  top: LAYOUT.jacket.y,
  scaleX: 0.29,
  scaleY: 0.39,
  patch: 22,
};

export interface DenLifeLayer {
  /** While inactive, items still render but nothing sparkles and nothing is marked seen. */
  setActive(active: boolean): void;
  /** The calendar's spoken and tooltip summary. */
  calendarSummary(): string;
  dispose(): void;
}

function required<T extends Element>(found: T | null, what: string): T {
  if (!found) throw new Error(`The Den is missing ${what}`);
  return found;
}

function hasKind(items: readonly GrowthItem[], kind: GrowthItem['kind']): boolean {
  return items.some((item) => item.kind === kind);
}

export function createDenLifeLayer(
  svg: SVGSVGElement,
  services: Services,
  options: { now?: () => Date } = {},
): DenLifeLayer {
  const { denLife, registry, repos, settings } = services;
  const now = options.now ?? (() => new Date());
  const rendered = new Map<Element, string>();
  let active = false;

  const fill = (target: Element, markup: string) => {
    if (rendered.get(target) === markup) return;
    rendered.set(target, markup);
    target.innerHTML = markup;
  };
  const slot = (kind: string) =>
    required(svg.querySelector<SVGGElement>(`[data-growth-slot="${kind}"]`), kind);
  const manifestById = (id: string) => registry.manifests.find((manifest) => manifest.id === id);

  const corkboardArt = required(
    svg.querySelector<SVGGElement>('[data-ref="corkboard-art"]'),
    'corkboard-art',
  );
  const chalkboardArt = required(
    svg.querySelector<SVGGElement>('[data-ref="chalkboard-art"]'),
    'chalkboard-art',
  );
  const catSlot = required(svg.querySelector<SVGGElement>('[data-ref="cat-slot"]'), 'cat-slot');
  const jacketPatches = required(
    svg.querySelector<SVGGElement>('[data-ref="jacket-patches"]'),
    'jacket-patches',
  );
  const jacketSpot = required(svg.querySelector<SVGGElement>('[data-ref="jacket"]'), 'jacket');
  const calendarGrid = required(
    svg.querySelector<SVGGElement>('[data-ref="calendar-grid"]'),
    'calendar-grid',
  );
  const calendarStreak = required(
    svg.querySelector<SVGGElement>('[data-ref="calendar-streak"]'),
    'calendar-streak',
  );
  const calendarDaily = required(
    svg.querySelector<SVGTextElement>('[data-ref="calendar-daily"]'),
    'calendar-daily',
  );
  const calendarMonthText = required(
    svg.querySelector<SVGTextElement>('[data-ref="calendar-month"]'),
    'calendar-month',
  );
  const calendarDayText = required(
    svg.querySelector<SVGTextElement>('[data-ref="calendar-day"]'),
    'calendar-day',
  );
  const calendarSpot = required(
    svg.querySelector<SVGGElement>('[data-ref="calendar"]'),
    'calendar',
  );

  // ——— Growth ———
  const renderGrowth = (items: readonly GrowthItem[]) => {
    const families = items.flatMap((item) =>
      item.kind === 'poster' && item.family ? [item.family] : [],
    );
    const legendGames = items.flatMap((item) => {
      const manifest = item.kind === 'trophy' && item.game ? manifestById(item.game) : undefined;
      return manifest ? [manifest] : [];
    });
    const lights = hasKind(items, 'string-lights');
    const onAir = hasKind(items, 'on-air');
    const completed = hasKind(items, 'plaque-and-remote');
    const secondBeanbag = hasKind(items, 'second-beanbag');
    fill(slot('posters'), posters(families));
    fill(slot('paper-chain'), hasKind(items, 'paper-chain') ? paperChain() : '');
    fill(slot('string-lights'), lights ? stringLights() : '');
    fill(slot('on-air'), onAir ? onAirSign() : '');
    fill(slot('remote'), completed ? remote() : '');
    fill(slot('plaque'), completed ? plaque() : '');
    fill(slot('trophies'), trophies(legendGames));
    fill(slot('second-beanbag'), secondBeanbag ? beanbag(LAYOUT.secondBeanbag, TEAL_BEANBAG) : '');
    fill(slot('glow'), (lights ? stringLightsGlow() : '') + (onAir ? onAirGlow() : ''));
    fill(catSlot, cat(secondBeanbag ? CAT_ON_SECOND_BEANBAG : LAYOUT.cat));
  };

  /** Where a newly earned item is drawn, so its sparkle lands on it. */
  const elementFor = (item: GrowthItem): Element | null => {
    switch (item.kind) {
      case 'trophy':
        return svg.querySelector(`.growth-trophy[data-game="${item.game ?? ''}"]`);
      case 'poster':
        return svg.querySelector(
          `[data-growth-slot="posters"] [data-family="${item.family ?? ''}"]`,
        );
      case 'ribbon':
        return svg.querySelector('[data-growth="ribbon"]');
      case 'plaque-and-remote':
        return slot('plaque');
      default:
        return slot(item.kind);
    }
  };

  const revealNew = (items: readonly GrowthItem[]) => {
    const seen = repos.progress.get().den.growthSeen;
    const fresh = items.filter((item) => seen[item.id] === undefined);
    if (fresh.length === 0) return;
    for (const item of fresh) {
      const target = elementFor(item);
      target?.classList.remove('growth-arriving');
      if (target) void target.getBoundingClientRect();
      target?.classList.add('growth-arriving');
    }
    for (const item of denLife.announceGrowth(fresh)) toast(item.toast, { tone: 'celebrate' });
    denLife.markGrowthSeen(fresh);
  };

  // ——— Corkboard, chalkboard, jacket ———
  const renderCorkboard = (champion: boolean) => {
    const kids = repos.progress.get().den.kids;
    const beaten = new Set(
      (Object.keys(kids) as KidId[]).filter((kid) => (kids[kid]?.wins ?? 0) > 0),
    );
    fill(corkboardArt, corkboard(beaten, champion));
  };

  const chalkboardScore = (): ChalkboardScore | null => {
    const live = services.versusNight.current();
    if (live) return live;
    const last = repos.progress.get().den.versus.recent.at(-1);
    if (!last) return null;
    const wins = [1, 2].map((seat) => last.games.filter((game) => game.winner === seat).length);
    return {
      names: last.names,
      wins: [wins[0] ?? 0, wins[1] ?? 0],
      bestOf: last.bestOf,
      winner: last.winner,
    };
  };

  const renderJacket = () => {
    const { jacket } = repos.progress.get().den;
    const games = repos.progress.get().games;
    const { centreX, top, scaleX, scaleY, patch } = DOOR_JACKET;
    const markup = jacket.placements
      .filter((placement) => placement.side === 'front')
      .sort((a, b) => a.z - b.z)
      .map((placement) => {
        const ownPatch = placement.game === DEN_OWNER.id;
        const manifest = ownPatch ? DEN_OWNER : manifestById(placement.game);
        const tier = ownPatch
          ? BLOCK_CHAMPION.tier
          : denLife.patchesFor(placement.game).find((def) => def.id === placement.patch)?.tier;
        if (!manifest || !tier) return '';
        const gold = ownPatch
          ? blockLadder(repos.progress.get().den.kids).beatenOnA.length === 6
          : Boolean(games[placement.game]?.patches[placement.patch]?.gold);
        const x = centreX + (placement.x - 300) * scaleX;
        const y = top + 12 + (placement.y - 90) * scaleY;
        const turn =
          placement.rotation === 0
            ? ''
            : `transform="rotate(${placement.rotation} ${n(x)} ${n(y)})"`;
        return patchImage(
          { manifest, patchId: placement.patch, tier, state: 'earned', gold },
          n(x - patch / 2),
          n(y - patch / 2),
          patch,
          turn,
        );
      })
      .join('');
    fill(jacketPatches, markup);
    const lookedAt = jacket.lookedAt ?? '';
    const news = Object.values(games).some((game) =>
      Object.values(game.patches).some((p) => p.earnedAt !== null && p.earnedAt > lookedAt),
    );
    jacketSpot.classList.toggle('has-news', news);
  };

  // ——— Calendar ———
  const today = () => {
    const date = now();
    const game = powerCycleOfTheDay(registry.manifests, date);
    const manifest = game ? manifestById(game.id) : undefined;
    const channel = manifest ? dailyChannel(manifest, date) : undefined;
    const played = manifest
      ? repos.progress.get().den.daily[utcDateKey(date)]?.[manifest.id] !== undefined
      : false;
    return { date, manifest, channel, played };
  };

  const calendarCell = (cell: CalendarCell, x: number, y: number, w: number, h: number): string => {
    const box = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="1" fill="var(--den-trim)" opacity="${cell.kind === 'future' ? 0.07 : 0.13}"/>`;
    const cx = x + w / 2;
    const cy = y + h / 2;
    let mark = '';
    if (cell.kind === 'played') {
      mark = `<path d="M${n(x + 1.6)} ${n(cy)}l${n(w * 0.25)} ${n(h * 0.38)}l${n(w * 0.55)} ${n(-h * 0.85)}" fill="none" stroke="#2f7a46" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (cell.kind === 'snow') {
      const r = h * 0.48;
      mark = [0, 60, 120]
        .map(
          (angle) =>
            `<path d="M${n(cx)} ${n(cy - r)}V${n(cy + r)}" transform="rotate(${angle} ${n(cx)} ${n(cy)})" stroke="#3f86c4" stroke-width="0.8" stroke-linecap="round"/>`,
        )
        .join('');
    }
    const ring = cell.today
      ? `<rect x="${n(x - 1.2)}" y="${n(y - 1.2)}" width="${n(w + 2.4)}" height="${n(h + 2.4)}" rx="2" fill="none" stroke="#b8433a" stroke-width="0.9"/>`
      : '';
    return box + mark + ring;
  };

  const renderCalendar = () => {
    const { x, y, width } = LAYOUT.calendar;
    const { date, manifest, channel, played } = today();
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const cells = calendarMonth(repos.progress.get().den.streak, year, month, date);
    // Weeks start on Monday, as on a European wall calendar.
    const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const columns = 7;
    const pitchX = (width - 14) / columns;
    const top = y + CALENDAR_PHOTO_HEIGHT + 33;
    const pitchY = 8;
    fill(
      calendarGrid,
      cells
        .map((cell, index) => {
          const position = offset + index;
          return calendarCell(
            cell,
            x + 7 + (position % columns) * pitchX + 1,
            top + Math.floor(position / columns) * pitchY,
            pitchX - 2.4,
            5.6,
          );
        })
        .join(''),
    );

    const streak = denLife.streak(date);
    fill(
      calendarStreak,
      streak.best === 0
        ? ''
        : `<g transform="rotate(-4 ${x + 30} ${y + 18})">` +
            `<rect x="${x + 8}" y="${y + 9}" width="54" height="18" rx="2" fill="#fbf3dc"/>` +
            `<rect x="${x + 8}" y="${y + 9}" width="54" height="18" rx="2" fill="none" stroke="#000" stroke-opacity="0.15"/>` +
            `<text x="${x + 11}" y="${y + 23}" font-family="var(--font-display)" font-weight="700" font-size="13" fill="#b8433a">${streak.current}</text>` +
            `<text x="${x + 59}" y="${y + 22}" text-anchor="end" font-family="var(--font-hand)" font-size="8" fill="#3a2b22">best ${streak.best}</text>` +
            `</g>`,
    );

    const channelText =
      manifest && channel ? ` · ch ${channelNumber(manifest.channels, channel.id)}` : '';
    const daily = `Daily #${dailyNumber(date)}${channelText}`;
    const monthName = date.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
    const day = String(date.getUTCDate());
    calendarMonthText.textContent = monthName.toUpperCase();
    calendarDayText.textContent = day;
    calendarDaily.textContent = `${daily}${played ? ' ✓' : ''}`;
    // The name changes with every mark printed, so it is kept here beside them.
    calendarSpot.setAttribute(
      'aria-label',
      calendarName({
        streak: streak.best === 0 ? null : streak,
        month: monthName,
        day,
        daily,
        played,
      }),
    );
  };

  const calendarSummary = (): string => {
    const { date, manifest, channel, played } = today();
    const streak = denLife.streak(date);
    const daily = `Daily #${dailyNumber(date)}`;
    if (!manifest || !channel) return `${daily}: the first Power Cycle arrives with the first game`;
    const streakText =
      streak.best === 0
        ? ''
        : ` · ${streak.current} ${streak.current === 1 ? 'day' : 'days'} in a row, best ${streak.best}`;
    return `${daily}: today's Power Cycle is ${manifest.title}, channel ${channelNumber(manifest.channels, channel.id)} (${channel.title}) · ${played ? 'played' : 'not played yet'}${streakText}`;
  };

  // ——— All 32 lamps ———
  const celebrateCounter = () => {
    const { den } = repos.progress.get();
    if (den.counterCompletedAt !== null || denLife.litLamps().length < COUNTER_SLOTS) return;
    repos.progress.update((draft) => {
      draft.den.counterCompletedAt = new Date().toISOString();
    });
    const lamps = [...svg.querySelectorAll<SVGElement>('[data-ref="counter-lamps"] .lamp')];
    lamps.forEach((lamp, index) => {
      lamp.style.animationDelay = `${index * 40}ms`;
      lamp.classList.remove('is-chasing');
      void lamp.getBoundingClientRect();
      lamp.classList.add('is-chasing');
    });
    services.audio.play('counter-bell');
    toast('All 32 lamps lit. The Counter rings its bell', { tone: 'celebrate' });
  };

  // ——— Everything ———
  const render = () => {
    const items = settings.get().showGrowth ? denLife.growth() : [];
    renderGrowth(items);
    renderCorkboard(hasKind(items, 'ribbon'));
    fill(chalkboardArt, denChalkboard(LAYOUT.chalkboard, chalkboardScore()));
    renderJacket();
    renderCalendar();
    if (active) {
      revealNew(items);
      celebrateCounter();
    }
  };

  render();
  const stop = denLife.onChange(render);
  const stopVersus = services.versusNight.onChange(render);

  return {
    setActive(next) {
      active = next;
      if (active) render();
    },
    calendarSummary,
    dispose() {
      stop();
      stopVersus();
    },
  };
}
