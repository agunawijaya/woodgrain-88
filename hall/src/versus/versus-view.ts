/**
 * Versus Night: two players on one machine, best of 3 or 5, the games drawn
 * from the shelf like a raffle. The screen has two faces. Before a series:
 * the setup card (names, a Neighbourhood Kid for a missing second player,
 * the length, and the pool). During and after one: the big chalkboard with
 * the tallies, the raffle shelf with the drawn cartridge lifted out, and the
 * button into the next game; at the end, a chalk crown and a Rematch that
 * keeps the names.
 *
 * The series itself lives in services.versusNight, so it survives the trips
 * into each game and back.
 */
import {
  BLOCK_LADDER,
  drawNextGame,
  KIDS,
  randomSeed,
  rematch,
  seatName,
  startSeries,
  validateDisplayName,
  validateVersusSetup,
  type GameManifest,
  type KidId,
  type VersusSeat,
  type VersusSeries,
  type VersusSetup,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { chalkboardFace, chalkDefs } from '../den/chalkboard.ts';
import { labelDocument } from '../den/label.ts';
import { escapeXml } from '../den/svg.ts';

export interface VersusView {
  readonly element: HTMLElement;
  dispose(): void;
}

const BOARD = { width: 1000, height: 560, frame: 34 };
const RAFFLE_MS = 1100;

/** A form field's text; file inputs and missing fields read as empty. */
function fieldText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

/** The big board: a pine frame, the slate, the chalk, and a ledge with chalk and an eraser. */
function bigChalkboard(series: VersusSeries | null, titleOf: (id: string) => string): string {
  const { width, height, frame } = BOARD;
  const faceW = width - frame * 2;
  const faceH = height - frame * 2;
  const score = series
    ? {
        names: [seatName(series.setup.seats[0]), seatName(series.setup.seats[1])] as const,
        wins: series.wins,
        bestOf: series.setup.bestOf,
        winner: series.winner,
        ...(series.current && series.phase !== 'finished'
          ? { nowPlaying: titleOf(series.current) }
          : {}),
      }
    : null;
  return (
    `<svg class="versus-board" viewBox="0 0 ${width} ${height + 26}" role="img" aria-labelledby="versus-board-label">` +
    `<defs>${chalkDefs()}` +
    `<pattern id="versus-pine" width="160" height="22" patternUnits="userSpaceOnUse"><rect width="160" height="22" fill="#b98049"/><path d="M0 6q40 -4 80 0t80 0M0 15q50 4 100 0t60 0" stroke="#8a5a2e" stroke-width="1.4" fill="none" opacity="0.5"/></pattern>` +
    `<radialGradient id="versus-slate" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#3a4a44"/><stop offset="1" stop-color="var(--chalk-slate)"/></radialGradient>` +
    `</defs>` +
    `<rect x="6" y="10" width="${width - 12}" height="${height}" rx="10" fill="#000" opacity="0.3"/>` +
    `<rect width="${width}" height="${height}" rx="10" fill="url(#versus-pine)"/>` +
    `<rect x="4" y="4" width="${width - 8}" height="6" rx="3" fill="#fff" opacity="0.18"/>` +
    `<rect x="${frame}" y="${frame}" width="${faceW}" height="${faceH}" rx="4" fill="url(#versus-slate)"/>` +
    `<rect x="${frame}" y="${frame}" width="${faceW}" height="${faceH}" rx="4" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="3"/>` +
    `<g transform="translate(${frame} ${frame})">${chalkboardFace(faceW, faceH, score)}</g>` +
    // The ledge: a stub of chalk and a felt eraser.
    `<rect x="40" y="${height - 6}" width="${width - 80}" height="14" rx="4" fill="#9a6a3a"/>` +
    `<rect x="120" y="${height - 11}" width="46" height="8" rx="4" fill="#f3efe4"/>` +
    `<rect x="${width - 220}" y="${height - 20}" width="96" height="18" rx="3" fill="#3b3b44"/><rect x="${width - 220}" y="${height - 20}" width="96" height="7" rx="3" fill="#8a6a3a"/>` +
    `</svg>`
  );
}

export function createVersusView(options: {
  services: Services;
  onBack(): void;
  onPlay(gameId: string): void;
}): VersusView {
  const { services } = options;
  const { versusNight, registry, repos, settings, audio } = services;
  const versusGames = registry.manifests
    .filter((manifest) => manifest.versus !== 'none')
    .sort((a, b) => a.slot - b.slot);
  const titleOf = (id: string) =>
    registry.manifests.find((manifest) => manifest.id === id)?.title ?? id;
  /** Shown instead of the series while the player sets up a new night. */
  let settingUp = versusNight.series() === null;
  let raffling = false;

  const element = document.createElement('section');
  element.className = 'den-life-screen versus-screen';
  element.setAttribute('aria-labelledby', 'versus-title');

  const kidOptions = (selected: KidId) =>
    BLOCK_LADDER.map((id) => {
      const kid = KIDS.find((candidate) => candidate.id === id);
      return kid
        ? `<option value="${id}"${id === selected ? ' selected' : ''}>${escapeXml(kid.name)}: ${escapeXml(kid.style.toLowerCase())}</option>`
        : '';
    }).join('');

  const setupMarkup = () => {
    const playerName = repos.profile.get().displayName;
    const bestOf = settings.get().versusBestOf;
    const pool = versusGames
      .map(
        (manifest) =>
          `<label class="pool-pick"><input type="checkbox" name="pool" value="${manifest.id}" checked><span class="pool-label">${labelDocument(manifest, `pool-${manifest.id}`)}</span><span class="pool-title">${escapeXml(manifest.title)}</span>${manifest.versus === 'local+bot' ? '<span class="pool-kid">Kid can play</span>' : ''}</label>`,
      )
      .join('');
    return (
      `<form class="versus-setup" data-ref="setup" novalidate>` +
      `<div class="versus-setup-main">` +
      `<h2>Tonight's line-up</h2>` +
      `<div class="versus-seats">` +
      `<label class="field"><span>Seat 1 (left)</span><input name="seat1" value="${escapeXml(playerName)}" maxlength="20" autocomplete="off" required></label>` +
      `<fieldset class="versus-seat2"><legend>Seat 2 (right)</legend>` +
      `<label class="choice"><input type="radio" name="seat2kind" value="human" checked><span>A second player</span></label>` +
      `<label class="choice"><input type="radio" name="seat2kind" value="kid"><span>A Neighbourhood Kid</span></label>` +
      `<label class="field" data-seat2="human"><span>Name</span><input name="seat2" value="Player 2" maxlength="20" autocomplete="off"></label>` +
      `<label class="field" data-seat2="kid" hidden><span>Kid</span><select name="kid">${kidOptions('rosa')}</select></label>` +
      `</fieldset>` +
      `</div>` +
      `<fieldset class="choices"><legend>How long</legend>` +
      `<label class="choice"><input type="radio" name="bestOf" value="3"${bestOf === 3 ? ' checked' : ''}><span>Best of 3</span></label>` +
      `<label class="choice"><input type="radio" name="bestOf" value="5"${bestOf === 5 ? ' checked' : ''}><span>Best of 5</span></label>` +
      `</fieldset>` +
      `<p class="versus-problems" data-ref="problems" role="alert"></p>` +
      `<div class="button-row"><button type="submit" class="button button--primary">Start the night</button></div>` +
      `</div>` +
      `<fieldset class="versus-pool"><legend>Games in the raffle</legend><p class="versus-pool-note">One is drawn for each game of the night. Untick any you would rather skip.</p>${pool || '<p>No two-player games are on the shelf yet.</p>'}</fieldset>` +
      `</form>`
    );
  };

  const seriesMarkup = (series: VersusSeries) => {
    const pool = series.setup.pool
      .map((id) => registry.manifests.find((manifest) => manifest.id === id))
      .filter((m): m is GameManifest => m !== undefined);
    const drawnLabel = (manifest: GameManifest) =>
      series.current === manifest.id && series.phase !== 'drawing';
    const shelf = pool
      .map(
        (manifest) =>
          `<li class="raffle-cartridge${drawnLabel(manifest) ? ' is-drawn' : ''}" data-game="${manifest.id}">${labelDocument(manifest, `raffle-${manifest.id}`)}</li>`,
      )
      .join('');
    const gameNumber = series.games.length + 1;
    const action =
      series.phase === 'finished'
        ? `<button type="button" class="button button--primary" data-do="rematch">Rematch</button><button type="button" class="button" data-do="new">New night</button>`
        : series.phase === 'playing' && series.current
          ? `<button type="button" class="button button--primary" data-do="play">Play game ${gameNumber}: ${escapeXml(titleOf(series.current))}</button>`
          : `<button type="button" class="button button--primary" data-do="draw">Draw game ${gameNumber}</button>`;
    const winner = series.winner ? seatName(series.setup.seats[series.winner === 1 ? 0 : 1]) : null;
    const status =
      winner !== null
        ? `${winner} takes the night, ${Math.max(...series.wins)}–${Math.min(...series.wins)}.`
        : `Game ${gameNumber} of up to ${series.setup.bestOf}. First to ${Math.ceil(series.setup.bestOf / 2)} wins the night.`;
    return (
      `<div class="versus-stage${winner ? ' is-crowned' : ''}">` +
      `<p id="versus-board-label" class="sr-only">${escapeXml(`${seatName(series.setup.seats[0])} ${series.wins[0]}, ${seatName(series.setup.seats[1])} ${series.wins[1]}. ${status}`)}</p>` +
      bigChalkboard(series, titleOf) +
      `<div class="raffle">` +
      `<p class="raffle-status" aria-live="polite">${escapeXml(status)}</p>` +
      (series.phase === 'finished'
        ? `<ol class="series-games" aria-label="The night, game by game">${series.games
            .map((game, index) => {
              const who =
                game.winner === null
                  ? 'a draw'
                  : seatName(series.setup.seats[game.winner === 1 ? 0 : 1]);
              return `<li><span>Game ${index + 1}</span><strong>${escapeXml(titleOf(game.game))}</strong><span>${escapeXml(who)}</span></li>`;
            })
            .join('')}</ol>`
        : `<ul class="raffle-shelf${raffling ? ' is-shuffling' : ''}" data-ref="shelf" aria-label="Games in the raffle">${shelf}</ul>`) +
      `<div class="button-row raffle-actions">${action}</div>` +
      `</div>` +
      `</div>`
    );
  };

  const rivalryMarkup = () => {
    const rivalries = Object.values(repos.progress.get().den.versus.rivalries)
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
      .slice(0, 6);
    if (rivalries.length === 0) return '';
    return (
      `<aside class="rivalries" aria-labelledby="rivalries-title"><h2 id="rivalries-title">Rivalries</h2><ul>` +
      rivalries
        .map(
          (rivalry) =>
            `<li><span>${escapeXml(rivalry.names[0])}</span><strong>${rivalry.series[0]} – ${rivalry.series[1]}</strong><span>${escapeXml(rivalry.names[1])}</span></li>`,
        )
        .join('') +
      `</ul><p class="rivalries-note">Series won, by the same two names.</p></aside>`
    );
  };

  const render = () => {
    const series = versusNight.series();
    element.innerHTML =
      `<header class="den-life-head">` +
      `<button type="button" class="button button--quiet" data-do="back">← Back to the Hall</button>` +
      `<div class="den-life-heading"><p class="den-life-kicker">The two pads</p><h1 id="versus-title">Versus Night</h1></div>` +
      (series && !settingUp
        ? `<div class="den-life-tools"><button type="button" class="button" data-do="new">New night</button></div>`
        : '') +
      `</header>` +
      `<div class="versus-layout">` +
      (settingUp || !series ? setupMarkup() : seriesMarkup(series)) +
      rivalryMarkup() +
      `</div>`;
  };

  const readSetup = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const problems: string[] = [];
    const first = validateDisplayName(fieldText(data, 'seat1'));
    if (!first.ok) problems.push(`Seat 1: ${first.reason}`);
    let second: VersusSeat;
    if (data.get('seat2kind') === 'kid') {
      second = { kind: 'kid', kid: fieldText(data, 'kid') as KidId };
    } else {
      const check = validateDisplayName(fieldText(data, 'seat2'));
      if (!check.ok) problems.push(`Seat 2: ${check.reason}`);
      second = { kind: 'human', name: check.ok ? check.value : '' };
    }
    const bestOf: 3 | 5 = data.get('bestOf') === '5' ? 5 : 3;
    const firstSeat: VersusSeat = { kind: 'human', name: first.ok ? first.value : '' };
    const wanted = data.getAll('pool').map(String);
    // A Kid can only take seat 2 in games that have a bot seat.
    const pool =
      second.kind === 'kid'
        ? wanted.filter(
            (id) => versusGames.find((manifest) => manifest.id === id)?.versus === 'local+bot',
          )
        : wanted;
    if (second.kind === 'kid' && wanted.length > 0 && pool.length === 0)
      problems.push(
        'None of the picked games has a seat for a Kid: pick one marked "Kid can play".',
      );
    const setup: VersusSetup = { seats: [firstSeat, second], bestOf, pool, seed: randomSeed() };
    if (problems.length === 0) problems.push(...validateVersusSetup(setup));
    return { setup, problems };
  };

  const draw = () => {
    const series = versusNight.series();
    if (!series || raffling) return;
    const drawn = drawNextGame(series);
    if (settings.reducedMotion()) {
      versusNight.set(drawn);
      return;
    }
    // The cartridges shuffle on the shelf, then the drawn one lifts out.
    raffling = true;
    render();
    audio.play('channel-blip');
    setTimeout(() => {
      raffling = false;
      versusNight.set(drawn);
      audio.play('flip-tick');
    }, RAFFLE_MS);
  };

  element.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-do]')?.dataset.do;
    const series = versusNight.series();
    if (action === 'back') options.onBack();
    if (action === 'draw') draw();
    if (action === 'play' && series?.current) options.onPlay(series.current);
    if (action === 'rematch' && series) versusNight.set(rematch(series, randomSeed()));
    if (action === 'new') {
      settingUp = true;
      render();
    }
  });
  // Seat 2 asks for a name or a Kid, whichever was picked.
  element.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name !== 'seat2kind') return;
    for (const field of element.querySelectorAll<HTMLElement>('[data-seat2]'))
      field.hidden = field.dataset.seat2 !== input.value;
  });
  element.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const { setup, problems } = readSetup(form);
    if (problems.length > 0) {
      const note = form.querySelector<HTMLParagraphElement>('[data-ref="problems"]');
      if (note) note.textContent = problems.join(' ');
      return;
    }
    settings.update((draft) => {
      draft.versusBestOf = setup.bestOf;
    });
    settingUp = false;
    versusNight.set(startSeries(setup));
  });

  render();
  // Back from a game, the scorer chalks up the result.
  if ((versusNight.series()?.games.length ?? 0) > 0) audio.play('chalk-squeak');
  let tallied = versusNight.series()?.games.length ?? 0;
  const stop = versusNight.onChange(() => {
    settingUp = false;
    const games = versusNight.series()?.games.length ?? 0;
    if (games > tallied) audio.play('chalk-squeak');
    tallied = games;
    render();
  });
  return {
    element,
    dispose() {
      stop();
      element.remove();
    },
  };
}
