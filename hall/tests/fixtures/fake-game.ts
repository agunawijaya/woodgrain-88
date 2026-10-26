/**
 * Test-only fake game: two paddles and a ball, for two seats or one seat
 * against a bot. It exists to prove the whole contract through the real
 * chrome (mount, loop, two-seat input, pause, events, three channels, a patch,
 * a micro-challenge, daily mode, challenge links, Hall-presented results,
 * difficulty switches, two cartridge versions and demo() on the Den's TV).
 * The harness puts it in slot 11 in place of the first merged game, so its second
 * version owns Counter lamp 31.
 */
import {
  aiSettings,
  type DemoContext,
  type DemoHandle,
  type GameContext,
  type GameInstance,
  type GameManifest,
  type GameModule,
  type InputFrame,
  type SwitchPosition,
} from '@woodgrain-88/kit';

export const FAKE_GAME_ID = 'test-paddles';
const WIDTH = 480;
const HEIGHT = 360;
const PADDLE = { width: 10, inset: 24, speed: 300 };

// The two cartridge versions differ only in paddle height, which is enough to
// see the chosen version arrive in the game.
const PADDLE_HEIGHT = { standard: 64, tall: 96 } as const;
const paddleHeightFor = (version: string | undefined): number =>
  version === 'tall' ? PADDLE_HEIGHT.tall : PADDLE_HEIGHT.standard;

function paddleHeightForSeat(baseHeight: number, switchPos: SwitchPosition): number {
  return switchPos === 'A' ? Math.round(baseHeight * (2 / 3)) : baseHeight;
}

const BALL_SIZE = 10;
const POINTS_TO_WIN = 3;

export const fakeManifest: GameManifest = {
  id: FAKE_GAME_ID,
  slot: 11,
  title: 'Test Paddles',
  tagline: 'A fixture that proves the contract, not a real game.',
  teaser: 'Two paddles and a ball, used only by the test harness to drive the Hall end to end.',
  family: 'arcade',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [1, 3],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#1b6a67', night: '#67d4cc' },
  emblem: 'M5 6v12M19 6v12M12 11h0',
  label: {
    pattern: 'grid',
    paper: '#fdf6e8',
    ink: '#9ccfc8',
    band: '#1b6a67',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Test fixture',
    uiTitle: 'the test fixture',
    publisher: 'Woodgrain',
    year: null,
    cartridgeSlots: [11, 19],
  },
  controls: [
    { keys: ['W', 'S'], does: 'move', seat: 1 },
    { keys: ['↑', '↓'], does: 'move', seat: 2 },
  ],
  channels: [
    {
      id: 'classic',
      kind: 'original',
      title: 'Classic',
      description: 'First to three.',
      originalGame: [1],
    },
    {
      id: 'fast',
      kind: 'original',
      title: 'Fast Ball',
      description: 'The ball starts twice as fast.',
      originalGame: [2],
    },
    {
      id: 'remix-wild',
      kind: 'remix',
      title: 'Wild Ball',
      description: 'Faster ball with unpredictable spin.',
      unlockedBy: 'first-point',
    },
  ],
  supports: { daily: true, challengeLinks: true, microChallenges: true },
  difficulty: {
    left: { a: 'Narrow paddle', b: 'Normal paddle' },
    right: { a: 'Narrow paddle', b: 'Normal paddle' },
    liveChange: true,
  },
  events: [
    { type: 'point', description: 'A seat scored a point.', fields: { seat: 'number' } },
    { type: 'rally', description: 'A rally ended.', fields: { hits: 'number' } },
  ],
  versions: [
    {
      id: 'standard',
      label: 'Standard',
      cartridgeSlot: 19,
      description: 'Paddles of the usual height.',
    },
    {
      id: 'tall',
      label: 'Tall paddles',
      cartridgeSlot: 11,
      description: 'Paddles half as tall again.',
    },
  ],
};

interface Court {
  paddleHeights: [number, number];
  paddles: [number, number];
  ball: { x: number; y: number; vx: number; vy: number };
  score: [number, number];
  hits: number;
}

function newCourt(speed: number, serveDirection: number, paddleHeights: [number, number]): Court {
  return {
    paddleHeights,
    paddles: [HEIGHT / 2, HEIGHT / 2],
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: speed * serveDirection, vy: speed * 0.45 },
    score: [0, 0],
    hits: 0,
  };
}

/** Moves the ball one step and reports which seat scored, if any. */
function stepBall(court: Court, dt: number): 0 | 1 | null {
  const { ball } = court;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < BALL_SIZE / 2 || ball.y > HEIGHT - BALL_SIZE / 2) {
    ball.vy *= -1;
  }
  for (const seat of [0, 1] as const) {
    const paddleX = seat === 0 ? PADDLE.inset : WIDTH - PADDLE.inset;
    const facing = seat === 0 ? ball.vx < 0 : ball.vx > 0;
    if (
      facing &&
      Math.abs(ball.x - paddleX) < PADDLE.width &&
      Math.abs(ball.y - court.paddles[seat]) < court.paddleHeights[seat] / 2
    ) {
      ball.vx *= -1.06;
      ball.vy += (ball.y - court.paddles[seat]) * 3;
      court.hits++;
    }
  }
  if (ball.x < 0) {
    return 1;
  }
  if (ball.x > WIDTH) {
    return 0;
  }
  return null;
}

function botMove(court: Court, seat: 0 | 1, dt: number): void {
  const target = court.ball.y;
  const delta = Math.max(
    -PADDLE.speed * 0.8 * dt,
    Math.min(PADDLE.speed * 0.8 * dt, target - court.paddles[seat]),
  );
  court.paddles[seat] += delta;
}

function draw(
  context: CanvasRenderingContext2D,
  court: Court,
  dark: boolean,
  caption: string,
): void {
  context.fillStyle = dark ? '#10161a' : '#f4efe2';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = dark ? '#67d4cc' : '#1b6a67';
  for (let y = 0; y < HEIGHT; y += 24) {
    context.fillRect(WIDTH / 2 - 2, y, 4, 12);
  }
  context.fillRect(
    PADDLE.inset - PADDLE.width / 2,
    court.paddles[0] - court.paddleHeights[0] / 2,
    PADDLE.width,
    court.paddleHeights[0],
  );
  context.fillRect(
    WIDTH - PADDLE.inset - PADDLE.width / 2,
    court.paddles[1] - court.paddleHeights[1] / 2,
    PADDLE.width,
    court.paddleHeights[1],
  );
  context.fillStyle = dark ? '#ffd27a' : '#b8481a';
  context.fillRect(
    court.ball.x - BALL_SIZE / 2,
    court.ball.y - BALL_SIZE / 2,
    BALL_SIZE,
    BALL_SIZE,
  );
  context.font = '800 40px sans-serif';
  context.textAlign = 'center';
  context.fillText(`${court.score[0]}   ${court.score[1]}`, WIDTH / 2, 52);
  if (caption) {
    context.font = '700 18px sans-serif';
    context.fillText(caption, WIDTH / 2, HEIGHT - 24);
  }
}

function mount(host: HTMLElement, ctx: GameContext): GameInstance {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.className = 'fake-game-canvas';
  canvas.setAttribute('aria-label', 'Test Paddles court');
  // Tests read which version the game was handed.
  canvas.dataset.version = ctx.run.version ?? '';
  host.append(canvas);
  const drawing = canvas.getContext('2d');
  const speed = ctx.run.channel === 'fast' ? 360 : ctx.run.channel === 'remix-wild' ? 400 : 180;
  const basePaddleHeight = paddleHeightFor(ctx.run.version);

  const resolvePaddleHeights = (): [number, number] => {
    const switches = ctx.difficulty.get();
    return [
      paddleHeightForSeat(basePaddleHeight, switches.left),
      paddleHeightForSeat(basePaddleHeight, switches.right),
    ];
  };

  let court = newCourt(speed, 1, resolvePaddleHeights());
  let state: 'menu' | 'play' | 'over' = 'menu';
  let versus = false;
  let startedAt = 0;
  let elapsed = 0;
  const pointEmojis: string[] = [];

  const botSeat = ctx.seats.find((seat) => seat.seat === 2 && seat.kind === 'bot');
  const botAi = botSeat?.kid !== undefined ? aiSettings(botSeat.kid) : undefined;
  let botReactionTimer = 0;
  let botTargetY = HEIGHT / 2;

  const updateBot = (dt: number) => {
    botReactionTimer -= dt;
    if (botReactionTimer <= 0) {
      botReactionTimer = (botAi?.reactionMs ?? 200) / 1000;
      const isError = botAi !== undefined ? ctx.rng.chance(botAi.errorRate) : false;
      botTargetY = isError ? court.ball.y + ctx.rng.float(-70, 70) : court.ball.y;
    }
    const delta = Math.max(
      -PADDLE.speed * 0.8 * dt,
      Math.min(PADDLE.speed * 0.8 * dt, botTargetY - court.paddles[1]),
    );
    court.paddles[1] += delta;
  };

  const menuCaption = () =>
    ctx.run.challenge
      ? `Beat ${ctx.run.challenge.score}: press Enter`
      : '1: play the bot · 2: two players';

  const start = (twoPlayers: boolean) => {
    versus = twoPlayers;
    pointEmojis.length = 0;
    court = newCourt(speed, ctx.rng.chance(0.5) ? 1 : -1, resolvePaddleHeights());
    state = 'play';
    startedAt = elapsed;
    ctx.setView('play');
  };

  const finish = (winner: 0 | 1) => {
    state = 'over';
    ctx.setView('results');
    ctx.reportResult({
      score: court.score[0] * 100 + court.hits,
      scoreLabel: `${court.score[0]}–${court.score[1]}`,
      durationMs: Math.round((elapsed - startedAt) * 1000),
      won: winner === 0,
      ...(versus ? { winnerSeat: winner === 0 ? (1 as const) : (2 as const) } : {}),
      details: [{ label: 'Rally hits', value: String(court.hits) }],
      emoji: pointEmojis.join(''),
      presentation: 'hall',
    });
  };

  const update = (dt: number) => {
    elapsed += dt;
    const frame: InputFrame = ctx.input.poll();
    if (state === 'menu') {
      if (frame.seats[1].pressed.has('fire') || frame.seats[2].pressed.has('fire')) {
        start(false);
      }
      return;
    }
    if (state !== 'play') {
      return;
    }
    const seatAxis = (seat: 1 | 2) => frame.seats[seat].axis.y;
    court.paddles[0] += seatAxis(1) * PADDLE.speed * dt;
    if (versus) {
      court.paddles[1] += seatAxis(2) * PADDLE.speed * dt;
    } else {
      updateBot(dt);
    }
    court.paddles = [
      Math.max(
        court.paddleHeights[0] / 2,
        Math.min(HEIGHT - court.paddleHeights[0] / 2, court.paddles[0]),
      ),
      Math.max(
        court.paddleHeights[1] / 2,
        Math.min(HEIGHT - court.paddleHeights[1] / 2, court.paddles[1]),
      ),
    ];
    const scorer = stepBall(court, dt);
    if (scorer === null) {
      return;
    }
    court.score[scorer]++;
    pointEmojis.push(scorer === 0 ? '🟩' : '🟥');
    ctx.emit({ type: 'point', data: { seat: scorer + 1 } });
    ctx.emit({ type: 'rally', data: { hits: court.hits } });
    if (court.score[scorer] >= POINTS_TO_WIN) {
      finish(scorer);
    } else {
      // Applied from the next point: update paddle heights per difficulty switches.
      court.paddleHeights = resolvePaddleHeights();
      court.ball = {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        vx: speed * (scorer === 0 ? 1 : -1),
        vy: speed * 0.45,
      };
    }
  };

  const loop = ctx.createLoop({
    update,
    render: () => {
      if (drawing) {
        draw(
          drawing,
          court,
          ctx.settings.appearance() === 'dark',
          state === 'menu' ? menuCaption() : '',
        );
      }
    },
  });

  const onKey = (event: KeyboardEvent) => {
    if (state !== 'menu') {
      return;
    }
    if (event.key === '1' || event.key === 'Enter') {
      start(false);
    }
    if (event.key === '2') {
      start(true);
    }
  };
  host.addEventListener('keydown', onKey);

  ctx.setPauseItems([{ id: 'restart', label: 'Restart the match', onSelect: () => start(versus) }]);
  ctx.setView('menu');
  loop.start();
  if (ctx.run.mode === 'daily' || ctx.run.mode === 'challenge' || ctx.run.micro) {
    start(false);
  }

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    gameMenu() {
      state = 'menu';
      ctx.setView('menu');
    },
    playAgain: () => start(versus),
    leaveCheck: () =>
      state === 'play' && court.score[0] + court.score[1] > 0 ? 'would-lose-progress' : 'safe',
    dispose() {
      loop.stop();
      host.removeEventListener('keydown', onKey);
      canvas.remove();
    },
  };
}

function demo(host: HTMLElement, seed: number, context: DemoContext): DemoHandle {
  const surface = document.createElement('canvas');
  surface.width = WIDTH;
  surface.height = HEIGHT;
  host.append(surface);
  const drawing = surface.getContext('2d');
  let dark = context.appearance === 'dark';
  const paddleHeight = paddleHeightFor(context.version);
  let court = newCourt(200, seed % 2 === 0 ? 1 : -1, [paddleHeight, paddleHeight]);
  let frame: number | null = null;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    botMove(court, 0, dt);
    botMove(court, 1, dt);
    if (stepBall(court, dt) !== null) {
      court = newCourt(200, court.ball.vx > 0 ? -1 : 1, [paddleHeight, paddleHeight]);
    }
    if (drawing) {
      draw(drawing, court, dark, '');
    }
    frame = context.reducedMotion ? null : requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    surface,
    setAppearance: (appearance) => {
      dark = appearance === 'dark';
    },
    resize: () => undefined,
    pause() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = null;
    },
    resume() {
      last = performance.now();
      frame ??= requestAnimationFrame(tick);
    },
    dispose() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      surface.remove();
    },
  };
}

export const fakeGame: GameModule = {
  manifest: fakeManifest,
  patches: [
    {
      id: 'first-point',
      tier: 'club',
      title: 'On the Board',
      description: 'Score a point.',
      goal: { metric: { kind: 'count', event: 'point' }, target: 1 },
    },
  ],
  microChallenges: [
    {
      id: 'three-points',
      channel: 'classic',
      title: 'Three Up',
      goal: 'Score 3 points',
      pass: { metric: { kind: 'count', event: 'point' }, target: 3 },
    },
  ],
  howToPlay: {
    goal: 'Keep the ball in play and get it past the other paddle. First to three wins.',
    controls: fakeManifest.controls,
    tips: ['Hit the ball with the paddle’s edge to send it at an angle.'],
  },
  mount,
  demo,
};
