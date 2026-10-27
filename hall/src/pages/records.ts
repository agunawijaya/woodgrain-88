/**
 * The Records page: the player's own history, kept in this browser. The Den
 * Life summary (streak, patches, gold thread, lamps, Block Ladder), every
 * personal best by game with each channel and mode underneath, Power Cycle
 * Run records, Versus Night rivalries, play statistics, and the save file.
 * There are no initials and no leaderboards: only your own runs.
 */
import {
  blockLadder,
  KIDS,
  RUN_ROUNDS,
  type GameManifest,
  type RunMode,
  type RunRecord,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { counterDigits, COUNTER_SLOTS } from '../data/cycle.ts';
import { escapeXml } from '../den/svg.ts';

export interface RecordsPage {
  readonly element: HTMLElement;
  dispose(): void;
}

const MODE_NAMES: Record<RunMode, string> = {
  normal: 'Normal',
  daily: 'Daily',
  challenge: 'Challenge',
  'power-cycle-run': 'Power Cycle Run',
  'versus-night': 'Versus Night',
};

function minutes(ms: number): string {
  const total = Math.round(ms / 60000);
  return total < 60 ? `${total} min` : `${Math.floor(total / 60)} h ${total % 60} min`;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Every board's best for one game, as "channel · mode" rows. */
function boardsFor(
  manifest: GameManifest,
  boards: Readonly<Record<string, RunRecord[]>>,
): { channel: string; mode: RunMode; best: RunRecord }[] {
  return Object.entries(boards).flatMap(([key, runs]) => {
    const [game, channel = '', mode = 'normal'] = key.split('/');
    const best = runs[0];
    if (game !== manifest.id || !best) return [];
    return [{ channel, mode: mode as RunMode, best }];
  });
}

export function createRecordsPage(options: {
  services: Services;
  onOpenSettings(): void;
}): RecordsPage {
  const { services } = options;
  const element = document.createElement('article');
  element.className = 'page page--records';
  element.setAttribute('aria-labelledby', 'records-title');

  const summary = () => {
    const { den, games } = services.repos.progress.get();
    const manifests = services.registry.manifests;
    const known = manifests.reduce(
      (total, manifest) => total + services.denLife.patchesFor(manifest.id).length,
      0,
    );
    const earnedPatches = Object.values(games).flatMap((game) =>
      Object.values(game.patches).filter((patch) => patch.earnedAt !== null),
    );
    const gold = earnedPatches.filter((patch) => patch.gold).length;
    const streak = services.denLife.streak();
    const ladder = blockLadder(den.kids);
    const facts = [
      [
        'Streak',
        `${streak.current} ${streak.current === 1 ? 'day' : 'days'} · best ${streak.best}`,
      ],
      ['Patches', `${earnedPatches.length} / ${known}`],
      ['Gold thread', `${gold}`],
      ['Counter lamps', `${services.denLife.litLamps().length} / ${COUNTER_SLOTS}`],
      ['Block Ladder', ladder.champion ? 'Block champion' : `${ladder.rung} / 6 rungs`],
      ['Versus Night series', `${den.versus.seriesPlayed}`],
    ];
    return `<dl class="records-totals records-totals--life">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeXml(value ?? '')}</dd></div>`).join('')}</dl>`;
  };

  const bests = () => {
    const boards = services.repos.records.get().boards;
    const rows = services.registry.manifests
      .map((manifest) => {
        const best = services.records.bestOverall(manifest.id, manifest.scoreOrder);
        const stats = services.stats.game(manifest.id);
        const perBoard = boardsFor(manifest, boards);
        const channelTitle = (id: string) =>
          manifest.channels.find((channel) => channel.id === id)?.title ?? id;
        const detail =
          perBoard.length > 1
            ? `<details class="records-boards"><summary>${perBoard.length} channels and modes</summary><ul>${perBoard
                .map(
                  (board) =>
                    `<li>${escapeXml(channelTitle(board.channel))} · ${MODE_NAMES[board.mode]}: <strong>${board.best.score.toLocaleString('en-GB')}</strong> (${day(board.best.at)})</li>`,
                )
                .join('')}</ul></details>`
            : '';
        return (
          `<tr><td>${counterDigits(manifest.slot)}</td><th scope="row">${escapeXml(manifest.title)}${detail}</th>` +
          `<td>${best ? best.score.toLocaleString('en-GB') : '—'}</td><td>${stats.plays}</td>` +
          `<td>${stats.timePlayedMs ? minutes(stats.timePlayedMs) : '—'}</td>` +
          `<td>${manifest.versus === 'none' ? '—' : `${stats.versusWins[1]} – ${stats.versusWins[2]}`}</td>` +
          `<td>${stats.lastPlayedAt ? day(stats.lastPlayedAt) : '—'}</td></tr>`
        );
      })
      .join('');
    return (
      `<div class="table-scroll"><table class="records-table"><caption>Best overall, with each channel and mode underneath</caption>` +
      `<thead><tr><th scope="col">Slot</th><th scope="col">Game</th><th scope="col">Best</th><th scope="col">Plays</th><th scope="col">Time</th><th scope="col">Versus (seat 1 – seat 2)</th><th scope="col">Last played</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></div>`
    );
  };

  const runs = () => {
    const { free, daily } = services.repos.progress.get().den.runs;
    const latestDaily = Object.entries(daily)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 5);
    const passes = (rounds: readonly { passed: boolean }[]) =>
      `${rounds.filter((round) => round.passed).length}/${RUN_ROUNDS}`;
    if (free.length === 0 && latestDaily.length === 0)
      return `<p>No runs yet. Hold POWER in the Den, or use the Power Cycle Run chip, once five games are on the shelf.</p>`;
    return (
      `<div class="records-columns">` +
      `<div><h3>Best free runs</h3><ol class="records-list">${
        free
          .slice(0, 5)
          .map(
            (run) =>
              `<li><strong>${run.score.toLocaleString('en-GB')}</strong> · ${passes(run.rounds)} · ${day(run.at)}</li>`,
          )
          .join('') || '<li>None yet</li>'
      }</ol></div>` +
      `<div><h3>Daily runs</h3><ol class="records-list">${latestDaily.map(([key, run]) => `<li>${escapeXml(key)} · <strong>${run.score.toLocaleString('en-GB')}</strong> · ${passes(run.rounds)}</li>`).join('') || '<li>None yet</li>'}</ol></div>` +
      `</div>`
    );
  };

  const versus = () => {
    const { rivalries, recent } = services.repos.progress.get().den.versus;
    const pairs = Object.values(rivalries).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    if (pairs.length === 0) return `<p>No Versus Night yet. Pick up the two pads in the Den.</p>`;
    return (
      `<ul class="records-rivalries">${pairs
        .map(
          (pair) =>
            `<li><span>${escapeXml(pair.names[0])}</span><strong>${pair.series[0]} – ${pair.series[1]}</strong><span>${escapeXml(pair.names[1])}</span><small>games ${pair.games[0]} – ${pair.games[1]} · last ${day(pair.lastAt)}</small></li>`,
        )
        .join('')}</ul>` + `<p class="page-note">${recent.length} recent series kept.</p>`
    );
  };

  const ladder = () => {
    const kids = services.repos.progress.get().den.kids;
    return `<ul class="records-kids">${KIDS.map((kid) => {
      const record = kids[kid.id];
      return `<li><strong>${escapeXml(kid.name)}</strong> <span>${record ? `won ${record.wins}, lost ${record.losses}${record.draws ? `, drew ${record.draws}` : ''}${record.winsOnA ? ` · ${record.winsOnA} on A` : ''}` : 'not played yet'}</span></li>`;
    }).join('')}</ul>`;
  };

  const render = () => {
    const totals = services.stats.totals();
    element.innerHTML =
      `<div class="page-inner">` +
      `<h1 id="records-title" class="page-title">Records</h1>` +
      `<p class="page-lede">Your bests and your history, kept in this browser.</p>` +
      summary() +
      `<section><h2>Personal bests</h2>${bests()}</section>` +
      `<section><h2>Power Cycle Run</h2>${runs()}</section>` +
      `<section><h2>Versus Night rivalries</h2>${versus()}</section>` +
      `<section><h2>The Neighbourhood Kids</h2>${ladder()}</section>` +
      `<section><h2>Time in the Den</h2><dl class="records-totals">` +
      `<div><dt>Plays</dt><dd>${totals.plays}</dd></div>` +
      `<div><dt>Games played</dt><dd>${totals.gamesPlayed} / ${services.registry.manifests.length}</dd></div>` +
      `<div><dt>Time</dt><dd>${minutes(totals.timePlayedMs)}</dd></div>` +
      `<div><dt>Couch versus matches</dt><dd>${totals.versusMatches}</dd></div>` +
      `</dl></section>` +
      `<section><h2>Your save file</h2><p>Move your Den to another browser, or keep a backup.</p>` +
      `<button type="button" class="button" data-do="data">Export or import in Settings</button></section>` +
      `</div>`;
  };
  element.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-do="data"]')) options.onOpenSettings();
  });
  const stops = [
    services.repos.records.onChange(render),
    services.repos.stats.onChange(render),
    services.repos.progress.onChange(render),
  ];
  render();
  return {
    element,
    dispose() {
      for (const stop of stops) stop();
      element.remove();
    },
  };
}
