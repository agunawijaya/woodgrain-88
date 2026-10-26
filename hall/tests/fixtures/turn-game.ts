/**
 * Test Grid fixture: a 3×3 turn-based board game for 1–2 players or one
 * player against a Neighbourhood Kid bot. It proves turn loops, bot personalities,
 * difficulty switch priority, misère remix unlock, and discrete move reporting.
 */
import {
  aiSettings,
  errorRateForRound,
  type AiSettings,
  type DemoContext,
  type DemoHandle,
  type GameContext,
  type GameInstance,
  type GameManifest,
  type GameModule,
  type PatchDef,
  type Seat,
} from '@woodgrain-88/kit';

export const TURN_GAME_ID = 'test-grid';
const CELL_COUNT = 9;
const BOARD_SIZE = 360;
const CELL_SIZE = BOARD_SIZE / 3;

const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findCompletingMove(board: readonly (Seat | null)[], targetSeat: Seat): number | null {
  for (const [a, b, c] of WIN_LINES) {
    const values = [board[a], board[b], board[c]];
    const countTarget = values.filter((val) => val === targetSeat).length;
    const countEmpty = values.filter((val) => val === null).length;
    if (countTarget === 2 && countEmpty === 1) {
      if (board[a] === null) {
        return a;
      }
      if (board[b] === null) {
        return b;
      }
      if (board[c] === null) {
        return c;
      }
    }
  }
  return null;
}

function checkWinner(board: readonly (Seat | null)[]): Seat | null {
  for (const [a, b, c] of WIN_LINES) {
    const val = board[a] ?? null;
    if (val !== null && val === board[b] && val === board[c]) {
      return val;
    }
  }
  return null;
}

/**
 * Pure move picker for the bot. Uses personality knobs, error rate,
 * symmetry mirroring, and tactical board evaluation.
 */
export function pickBotMove(
  board: readonly (Seat | null)[],
  seat: Seat,
  settings: AiSettings,
  draw: number,
  lastHumanMove: number | null,
): number {
  const legalMoves: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i] === null) {
      legalMoves.push(i);
    }
  }
  if (legalMoves.length === 0) {
    return -1;
  }

  const rate = errorRateForRound(settings, draw);
  const errs = draw < rate;
  const opponentSeat: Seat = seat === 1 ? 2 : 1;

  if (errs) {
    // When committing an error, deliberately pick away from the optimal move if possible.
    const bestMove = findCompletingMove(board, seat) ?? findCompletingMove(board, opponentSeat);
    const nonBest = bestMove !== null ? legalMoves.filter((move) => move !== bestMove) : legalMoves;
    const pool = nonBest.length > 0 ? nonBest : legalMoves;
    const index = Math.floor(Math.abs(draw * 31 + 7) % pool.length);
    return pool[index] ?? legalMoves[0] ?? 0;
  }

  // 1. Immediate win
  const winMove = findCompletingMove(board, seat);
  if (winMove !== null) {
    return winMove;
  }

  // 2. Immediate block
  const blockMove = findCompletingMove(board, opponentSeat);
  if (blockMove !== null) {
    return blockMove;
  }

  // 3. Benny mirrors human move across center symmetry
  if (settings.mirror && lastHumanMove !== null) {
    const mirrored = 8 - lastHumanMove;
    if (board[mirrored] === null) {
      return mirrored;
    }
  }

  // 4. Positional hierarchy: corners preferred when deception is high, otherwise center
  const corners = [0, 2, 6, 8];
  const sides = [1, 3, 5, 7];
  const preferenceOrder =
    settings.deception > 0.7 ? [...corners, 4, ...sides] : [4, ...corners, ...sides];

  for (const cell of preferenceOrder) {
    if (board[cell] === null) {
      return cell;
    }
  }

  return legalMoves[0] ?? 0;
}

export const turnManifest: GameManifest = {
  id: TURN_GAME_ID,
  slot: 20,
  title: 'Test Grid',
  tagline: 'A 3×3 duel of marks and tactics.',
  teaser: 'Place three marks in a row to win, or outsmart your opponent on the turn grid.',
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [1, 5],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#2a5a8c', night: '#74a8db' },
  emblem: 'M8 3v18M16 3v18M3 8h18M3 16h18',
  label: {
    pattern: 'grid',
    paper: '#fbf5eb',
    ink: '#c1d4e6',
    band: '#2a5a8c',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Test Grid',
    uiTitle: 'the grid duel',
    publisher: 'Woodgrain',
    year: null,
    cartridgeSlots: [20],
  },
  controls: [
    { keys: ['W', 'A', 'S', 'D', 'Space'], does: 'move cursor and place', seat: 1 },
    { keys: ['↑', '←', '↓', '→', 'Enter'], does: 'move cursor and place', seat: 2 },
  ],
  channels: [
    {
      id: 'classic',
      kind: 'original',
      title: 'Classic',
      description: 'Three in a row wins.',
      originalGame: [1],
    },
    {
      id: 'misere',
      kind: 'remix',
      title: 'Misère',
      description: 'Three in a row loses.',
      unlockedBy: 'three-wins',
    },
  ],
  supports: { daily: true, challengeLinks: true, microChallenges: false },
  difficulty: {
    left: { a: 'Bot moves first', b: 'You move first' },
    liveChange: false,
  },
  events: [
    { type: 'move', description: 'A mark was placed.', fields: { cell: 'number' } },
    { type: 'win', description: 'A player achieved three in a row.', fields: { seat: 'number' } },
    { type: 'draw', description: 'The game ended in a draw.' },
  ],
};

const patches: readonly PatchDef[] = [
  {
    id: 'first-win',
    tier: 'club',
    title: 'First Win',
    description: 'Win one match.',
    goal: { metric: { kind: 'count', event: 'win' }, target: 1 },
  },
  {
    id: 'three-wins',
    tier: 'pro',
    title: 'Triple Win',
    description: 'Win three matches.',
    goal: { metric: { kind: 'count', event: 'win' }, target: 3 },
  },
  {
    id: 'ten-wins',
    tier: 'legend',
    title: 'Decade',
    description: 'Win ten matches.',
    goal: { metric: { kind: 'count', event: 'win' }, target: 10 },
  },
  {
    id: 'perfect-draw',
    tier: 'secret',
    title: 'Cat Game',
    description: 'Achieve three draws.',
    hint: 'Share the board three times in peace.',
    goal: { metric: { kind: 'count', event: 'draw' }, target: 3 },
  },
];

function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: readonly (Seat | null)[],
  cursor: number,
  dark: boolean,
): void {
  ctx.fillStyle = dark ? '#10161a' : '#fcf8f0';
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Draw grid lines
  ctx.strokeStyle = dark ? '#415e7d' : '#8daecf';
  ctx.lineWidth = 4;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 12);
    ctx.lineTo(i * CELL_SIZE, BOARD_SIZE - 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, i * CELL_SIZE);
    ctx.lineTo(BOARD_SIZE - 12, i * CELL_SIZE);
    ctx.stroke();
  }

  // Draw cursor box
  const cursorCol = cursor % 3;
  const cursorRow = Math.floor(cursor / 3);
  ctx.strokeStyle = dark ? '#74a8db' : '#2a5a8c';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    cursorCol * CELL_SIZE + 6,
    cursorRow * CELL_SIZE + 6,
    CELL_SIZE - 12,
    CELL_SIZE - 12,
  );

  // Draw marks
  for (let i = 0; i < CELL_COUNT; i++) {
    const mark = board[i];
    if (mark === null) {
      continue;
    }
    const col = i % 3;
    const row = Math.floor(i / 3);
    const centerX = col * CELL_SIZE + CELL_SIZE / 2;
    const centerY = row * CELL_SIZE + CELL_SIZE / 2;

    if (mark === 1) {
      // Seat 1 = X
      ctx.strokeStyle = dark ? '#67d4cc' : '#1b6a67';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(centerX - 24, centerY - 24);
      ctx.lineTo(centerX + 24, centerY + 24);
      ctx.moveTo(centerX + 24, centerY - 24);
      ctx.lineTo(centerX - 24, centerY + 24);
      ctx.stroke();
    } else {
      // Seat 2 = O
      ctx.strokeStyle = dark ? '#ffd27a' : '#b8481a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function mount(host: HTMLElement, ctx: GameContext): GameInstance {
  const container = document.createElement('div');
  container.className = 'test-grid-container';
  container.style.position = 'relative';
  container.style.width = `${BOARD_SIZE}px`;
  container.style.height = `${BOARD_SIZE}px`;
  host.append(container);

  const canvas = document.createElement('canvas');
  canvas.width = BOARD_SIZE;
  canvas.height = BOARD_SIZE;
  canvas.className = 'test-grid-canvas';
  canvas.setAttribute('aria-label', 'Test Grid board');
  container.append(canvas);

  const overlay = document.createElement('div');
  overlay.className = 'test-grid-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = `${BOARD_SIZE}px`;
  overlay.style.height = `${BOARD_SIZE}px`;
  overlay.style.display = 'grid';
  overlay.style.gridTemplateColumns = 'repeat(3, 1fr)';
  overlay.style.gridTemplateRows = 'repeat(3, 1fr)';
  container.append(overlay);

  const cellButtons: HTMLButtonElement[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.cell = String(i);
    btn.setAttribute('aria-label', `Cell ${i}`);
    btn.style.opacity = '0';
    btn.style.width = '100%';
    btn.style.height = '100%';
    btn.style.cursor = 'pointer';
    overlay.append(btn);
    cellButtons.push(btn);
  }

  const drawing = canvas.getContext('2d');
  const isMisere = ctx.run.channel === 'misere';
  const board: (Seat | null)[] = Array.from({ length: CELL_COUNT }, () => null);

  const botSeatInfo = ctx.seats.find((seat) => seat.seat === 2 && seat.kind === 'bot');
  const isBotGame = botSeatInfo !== undefined;
  const botAi = botSeatInfo?.kid !== undefined ? aiSettings(botSeatInfo.kid) : aiSettings('dee');

  // Left A switch determines whether bot moves first in 1P mode
  const botMovesFirst = isBotGame && ctx.difficulty.get().left === 'A';
  let currentSeat: Seat = botMovesFirst ? 2 : 1;
  let cursor = 4;
  let lastHumanMove: number | null = null;
  let state: 'menu' | 'play' | 'over' = 'menu';
  let botTimer: number | null = null;
  let startedAt = 0;
  const elapsed = 0;

  const render = () => {
    if (drawing) {
      drawBoard(drawing, board, cursor, ctx.settings.appearance() === 'dark');
    }
  };

  const loop = ctx.createLoop({
    mode: 'turns',
    render,
  });

  const clearBotTimer = () => {
    if (botTimer !== null) {
      window.clearTimeout(botTimer);
      botTimer = null;
    }
  };

  const finishGame = (winner: Seat | null) => {
    state = 'over';
    clearBotTimer();
    ctx.setView('results');

    if (winner !== null) {
      ctx.emit({ type: 'win', data: { seat: winner } });
    } else {
      ctx.emit({ type: 'draw' });
    }

    const won = winner === 1;
    const score = won ? 100 : winner === null ? 50 : 0;
    const scoreLabel = won ? 'Win' : winner === null ? 'Draw' : 'Loss';
    const emoji = won ? '🟩' : winner === null ? '🟨' : '🟥';

    ctx.reportResult({
      score,
      scoreLabel,
      durationMs: Math.round((elapsed - startedAt) * 1000),
      won,
      winnerSeat: winner,
      emoji,
      presentation: 'hall',
    });
  };

  const evaluateTurn = () => {
    const rawWinner = checkWinner(board);
    if (rawWinner !== null) {
      const winner = isMisere ? (rawWinner === 1 ? 2 : 1) : rawWinner;
      finishGame(winner);
      return;
    }
    if (board.every((cell) => cell !== null)) {
      finishGame(null);
      return;
    }

    currentSeat = currentSeat === 1 ? 2 : 1;
    loop.invalidate();

    if (state === 'play' && isBotGame && currentSeat === 2) {
      scheduleBotMove();
    }
  };

  const applyMove = (cell: number, seat: Seat) => {
    if (board[cell] !== null || state !== 'play') {
      return;
    }
    board[cell] = seat;
    ctx.emit({ type: 'move', data: { cell } });
    if (seat === 1) {
      lastHumanMove = cell;
    }
    evaluateTurn();
  };

  const scheduleBotMove = () => {
    clearBotTimer();
    const delay = botAi.reactionMs;
    botTimer = window.setTimeout(() => {
      if (state !== 'play') {
        return;
      }
      const drawValue = ctx.rng.next();
      const move = pickBotMove(board, 2, botAi, drawValue, lastHumanMove);
      if (move >= 0 && board[move] === null) {
        applyMove(move, 2);
      }
    }, delay);
  };

  const start = () => {
    clearBotTimer();
    for (let i = 0; i < CELL_COUNT; i++) {
      board[i] = null;
    }
    currentSeat = botMovesFirst ? 2 : 1;
    cursor = 4;
    lastHumanMove = null;
    state = 'play';
    startedAt = elapsed;
    ctx.setView('play');
    loop.invalidate();

    if (isBotGame && currentSeat === 2) {
      scheduleBotMove();
    }
  };

  const handleCellClick = (index: number) => {
    if (state !== 'play') {
      start();
      return;
    }
    if (isBotGame && currentSeat === 2) {
      return;
    }
    cursor = index;
    applyMove(index, currentSeat);
  };

  cellButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => handleCellClick(index));
  });

  const onKey = (event: KeyboardEvent) => {
    if (state === 'menu') {
      if (event.key === 'Enter' || event.key === ' ') {
        start();
      }
      return;
    }
    if (state !== 'play') {
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      cursor = (cursor - 3 + CELL_COUNT) % CELL_COUNT;
      loop.invalidate();
    } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
      cursor = (cursor + 3) % CELL_COUNT;
      loop.invalidate();
    } else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      cursor = cursor % 3 === 0 ? cursor + 2 : cursor - 1;
      loop.invalidate();
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      cursor = cursor % 3 === 2 ? cursor - 2 : cursor + 1;
      loop.invalidate();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!isBotGame || currentSeat === 1) {
        applyMove(cursor, currentSeat);
      }
    }
  };

  host.addEventListener('keydown', onKey);
  ctx.setPauseItems([{ id: 'restart', label: 'Restart match', onSelect: start }]);
  ctx.setView('menu');
  loop.start();

  if (ctx.run.mode === 'daily' || ctx.run.mode === 'challenge') {
    start();
  }

  return {
    pause: () => {
      clearBotTimer();
      loop.pause();
    },
    resume: () => {
      loop.resume();
      if (state === 'play' && isBotGame && currentSeat === 2) {
        scheduleBotMove();
      }
    },
    gameMenu: () => {
      state = 'menu';
      clearBotTimer();
      ctx.setView('menu');
      loop.invalidate();
    },
    playAgain: start,
    leaveCheck: () =>
      state === 'play' && board.some((cell) => cell !== null) ? 'would-lose-progress' : 'safe',
    dispose: () => {
      clearBotTimer();
      loop.stop();
      host.removeEventListener('keydown', onKey);
      container.remove();
    },
  };
}

function demo(host: HTMLElement, seed: number, context: DemoContext): DemoHandle {
  const canvas = document.createElement('canvas');
  canvas.width = BOARD_SIZE;
  canvas.height = BOARD_SIZE;
  host.append(canvas);
  const drawing = canvas.getContext('2d');
  let dark = context.appearance === 'dark';

  const board: (Seat | null)[] = Array.from({ length: CELL_COUNT }, () => null);
  let activeSeat: Seat = (seed % 2) + 1 === 1 ? 1 : 2;
  let timer: number | null = null;
  const dummySettings = aiSettings('pip');

  const stepAttract = () => {
    const winner = checkWinner(board);
    if (winner !== null || board.every((c) => c !== null)) {
      for (let i = 0; i < CELL_COUNT; i++) {
        board[i] = null;
      }
      activeSeat = 1;
    } else {
      const move = pickBotMove(board, activeSeat, dummySettings, 0.5, null);
      if (move >= 0 && board[move] === null) {
        board[move] = activeSeat;
        activeSeat = activeSeat === 1 ? 2 : 1;
      }
    }
    if (drawing) {
      drawBoard(drawing, board, -1, dark);
    }
    if (!context.reducedMotion) {
      timer = window.setTimeout(stepAttract, 600);
    }
  };

  if (!context.reducedMotion) {
    timer = window.setTimeout(stepAttract, 400);
  } else if (drawing) {
    drawBoard(drawing, board, -1, dark);
  }

  return {
    surface: canvas,
    setAppearance: (appearance) => {
      dark = appearance === 'dark';
      if (drawing) {
        drawBoard(drawing, board, -1, dark);
      }
    },
    resize: () => undefined,
    pause: () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    },
    resume: () => {
      if (timer === null && !context.reducedMotion) {
        timer = window.setTimeout(stepAttract, 500);
      }
    },
    dispose: () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      canvas.remove();
    },
  };
}

export const turnGame: GameModule = {
  manifest: turnManifest,
  patches,
  howToPlay: {
    goal: 'Align three of your marks horizontally, vertically, or diagonally.',
    controls: turnManifest.controls,
    tips: ['Seize the center early, or stage a corner trap to force a double threat.'],
  },
  mount,
  demo,
};
