/**
 * Test Catch fixture: a single-player arcade game where a basket moves left
 * and right to catch falling dots. It proves channel matrix scaling (30 variations),
 * micro-challenge integration, difficulty switch modifiers, and streak metric reporting.
 */
import type {
  ChannelDef,
  DemoContext,
  DemoHandle,
  GameContext,
  GameInstance,
  GameManifest,
  GameModule,
  MicroChallengeDef,
  PatchDef,
} from '@woodgrain-88/kit';

export const CATCH_GAME_ID = 'test-catch';
const WIDTH = 480;
const HEIGHT = 360;
const MAX_MISSES = 3;
const DEFAULT_RUN_SECONDS = 30;

const CHANNEL_GROUPS = ['Slow', 'Brisk', 'Fast', 'Wind', 'Night'] as const;
type ChannelGroup = (typeof CHANNEL_GROUPS)[number];

const channels: ChannelDef[] = CHANNEL_GROUPS.flatMap((group, groupIndex) =>
  Array.from({ length: 6 }, (_, index) => {
    const num = index + 1;
    const slotNumber = groupIndex * 6 + num;
    const id = `${group.toLowerCase()}-${num}`;
    return {
      id,
      kind: 'original' as const,
      title: `${group} ${num}`,
      description: `${group} pace, variation ${num}.`,
      group,
      originalGame: [slotNumber],
    };
  }),
);

function groupForChannel(channelId: string): ChannelGroup {
  const prefix = channelId.split('-')[0]?.toLowerCase();
  switch (prefix) {
    case 'slow':
      return 'Slow';
    case 'brisk':
      return 'Brisk';
    case 'fast':
      return 'Fast';
    case 'wind':
      return 'Wind';
    case 'night':
      return 'Night';
    default:
      return 'Slow';
  }
}

function physicsForGroup(group: ChannelGroup): { vy: number; drift: number } {
  switch (group) {
    case 'Slow':
      return { vy: 140, drift: 0 };
    case 'Brisk':
      return { vy: 200, drift: 25 };
    case 'Fast':
      return { vy: 280, drift: 45 };
    case 'Wind':
      return { vy: 210, drift: 90 };
    case 'Night':
      return { vy: 230, drift: 30 };
  }
}

export const catchManifest: GameManifest = {
  id: CATCH_GAME_ID,
  slot: 26,
  title: 'Test Catch',
  tagline: 'Catch falling dots in a nimble basket.',
  teaser: 'Slide your basket left and right to catch dots before they slip past.',
  family: 'arcade',
  players: '1P',
  versus: 'none',
  sessionMinutes: [1, 2],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#b34700', night: '#ff944d' },
  emblem: 'M4 14h16l-2 7H6zM12 4h0',
  label: {
    pattern: 'dots',
    paper: '#fbf5eb',
    ink: '#f0c79e',
    band: '#b34700',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Test Catch',
    uiTitle: 'the catch game',
    publisher: 'Woodgrain',
    year: null,
    cartridgeSlots: [26],
  },
  controls: [{ keys: ['←', '→', 'A', 'D'], does: 'move basket' }],
  channels,
  supports: { daily: true, challengeLinks: true, microChallenges: true },
  difficulty: {
    left: { a: 'Smaller basket', b: 'Normal basket' },
    liveChange: false,
  },
  events: [
    { type: 'catch', description: 'A falling dot was caught.', fields: { streak: 'number' } },
    { type: 'miss', description: 'A falling dot was missed.' },
  ],
};

const patches: readonly PatchDef[] = [
  {
    id: 'ten-catches',
    tier: 'club',
    title: 'Ten Catches',
    description: 'Catch 10 dots.',
    goal: { metric: { kind: 'count', event: 'catch' }, target: 10 },
  },
  {
    id: 'streak-ten',
    tier: 'pro',
    title: 'Ten in a Row',
    description: 'Reach a streak of 10 catches.',
    goal: { metric: { kind: 'max', event: 'catch', field: 'streak' }, target: 10 },
  },
  {
    id: 'hundred',
    tier: 'legend',
    title: 'Century',
    description: 'Catch 100 dots.',
    goal: { metric: { kind: 'count', event: 'catch' }, target: 100 },
  },
];

const microChallenges: readonly MicroChallengeDef[] = [
  {
    id: 'catch-five',
    channel: 'slow-1',
    title: 'Catch Five',
    goal: 'Catch 5 dots',
    pass: { metric: { kind: 'count', event: 'catch' }, target: 5 },
  },
  {
    id: 'streak-four',
    channel: 'slow-1',
    title: 'Streak Four',
    goal: 'Reach a streak of 4',
    pass: { metric: { kind: 'max', event: 'catch', field: 'streak' }, target: 4 },
  },
  {
    id: 'no-miss',
    channel: 'slow-1',
    title: 'No Miss Catch',
    goal: 'Catch 8 dots without missing',
    pass: { metric: { kind: 'count', event: 'catch' }, target: 8 },
  },
];

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function drawGame(
  context: CanvasRenderingContext2D,
  basketX: number,
  basketWidth: number,
  dots: readonly Dot[],
  score: number,
  misses: number,
  remainingSeconds: number,
  dark: boolean,
  microGoal?: string,
): void {
  context.fillStyle = dark ? '#10161a' : '#fcf8f0';
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Micro challenge goal banner
  if (microGoal !== undefined) {
    context.fillStyle = dark ? '#ff944d' : '#b34700';
    context.font = '700 16px sans-serif';
    context.textAlign = 'center';
    context.fillText(microGoal, WIDTH / 2, 28);
  }

  // Draw HUD: score, misses, time
  context.fillStyle = dark ? '#f5ebd9' : '#23180f';
  context.font = '700 20px sans-serif';
  context.textAlign = 'left';
  context.fillText(`Score: ${score}`, 24, 32);

  context.textAlign = 'right';
  context.fillText(`Time: ${Math.ceil(remainingSeconds)}s`, WIDTH - 24, 32);

  // Miss indicators
  context.fillStyle = '#e8463a';
  for (let i = 0; i < MAX_MISSES; i++) {
    const x = WIDTH / 2 - 24 + i * 24;
    if (i < misses) {
      context.beginPath();
      context.arc(x, 50, 6, 0, Math.PI * 2);
      context.fill();
    } else {
      context.strokeStyle = dark ? '#5c4433' : '#d8c7a8';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, 50, 6, 0, Math.PI * 2);
      context.stroke();
    }
  }

  // Draw basket
  const basketY = HEIGHT - 36;
  context.fillStyle = dark ? '#ff944d' : '#b34700';
  context.fillRect(basketX - basketWidth / 2, basketY, basketWidth, 14);

  // Draw falling dots
  context.fillStyle = dark ? '#67d4cc' : '#1b6a67';
  for (const dot of dots) {
    context.beginPath();
    context.arc(dot.x, dot.y, 7, 0, Math.PI * 2);
    context.fill();
  }
}

function mount(host: HTMLElement, ctx: GameContext): GameInstance {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.className = 'test-catch-canvas';
  canvas.setAttribute('aria-label', 'Test Catch playfield');
  host.append(canvas);

  const drawing = canvas.getContext('2d');
  const group = groupForChannel(ctx.run.channel);
  const physics = physicsForGroup(group);

  // Switch A shrinks basket from 64 to 42 px
  const basketWidth = ctx.difficulty.get().left === 'A' ? 42 : 64;
  const basketSpeed = 340;
  const maxTime = ctx.run.micro !== undefined ? ctx.run.micro.seconds : DEFAULT_RUN_SECONDS;

  let basketX = WIDTH / 2;
  const dots: Dot[] = [];
  let score = 0;
  let streak = 0;
  let misses = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let state: 'menu' | 'play' | 'over' = 'menu';

  const spawnDot = () => {
    const x = ctx.rng.float(32, WIDTH - 32);
    const driftSign = ctx.rng.chance(0.5) ? 1 : -1;
    const vx = physics.drift * driftSign;
    dots.push({ x, y: 0, vx, vy: physics.vy });
  };

  const finish = () => {
    state = 'over';
    ctx.setView('results');

    const emojiCount = Math.min(12, Math.floor(score / 5));
    const emoji = emojiCount > 0 ? '🟢'.repeat(emojiCount) : undefined;

    ctx.reportResult({
      score,
      scoreLabel: `${score} caught`,
      durationMs: Math.round(elapsed * 1000),
      won: misses < MAX_MISSES && score > 0,
      ...(emoji === undefined ? {} : { emoji }),
      presentation: 'hall',
    });
  };

  const start = () => {
    basketX = WIDTH / 2;
    dots.length = 0;
    score = 0;
    streak = 0;
    misses = 0;
    elapsed = 0;
    spawnTimer = 0;
    state = 'play';
    ctx.setView('play');
    spawnDot();
  };

  const update = (dt: number) => {
    if (state !== 'play') {
      return;
    }
    elapsed += dt;
    if (elapsed >= maxTime) {
      finish();
      return;
    }

    const frame = ctx.input.poll();
    const axisX = frame.seats[1].axis.x;
    basketX += axisX * basketSpeed * dt;
    basketX = Math.max(basketWidth / 2, Math.min(WIDTH - basketWidth / 2, basketX));

    spawnTimer += dt;
    if (spawnTimer >= 0.8) {
      spawnTimer = 0;
      spawnDot();
    }

    const basketY = HEIGHT - 36;
    for (let i = dots.length - 1; i >= 0; i--) {
      const dot = dots[i];
      if (dot === undefined) {
        continue;
      }
      dot.x += dot.vx * dt;
      dot.y += dot.vy * dt;

      // Bounce off side walls
      if (dot.x < 10) {
        dot.x = 10;
        dot.vx *= -1;
      } else if (dot.x > WIDTH - 10) {
        dot.x = WIDTH - 10;
        dot.vx *= -1;
      }

      // Catch check
      if (
        dot.y >= basketY - 7 &&
        dot.y <= basketY + 14 &&
        dot.x >= basketX - basketWidth / 2 &&
        dot.x <= basketX + basketWidth / 2
      ) {
        score++;
        streak++;
        ctx.emit({ type: 'catch', data: { streak } });
        dots.splice(i, 1);
        continue;
      }

      // Miss check
      if (dot.y > HEIGHT) {
        misses++;
        streak = 0;
        ctx.emit({ type: 'miss' });
        dots.splice(i, 1);

        if (misses >= MAX_MISSES) {
          finish();
          return;
        }
      }
    }
  };

  const loop = ctx.createLoop({
    update,
    render: () => {
      if (drawing) {
        drawGame(
          drawing,
          basketX,
          basketWidth,
          dots,
          score,
          misses,
          Math.max(0, maxTime - elapsed),
          ctx.settings.appearance() === 'dark',
          ctx.run.micro?.goal,
        );
      }
    },
  });

  const onKey = (event: KeyboardEvent) => {
    if (state === 'menu' && (event.key === 'Enter' || event.key === ' ')) {
      start();
    }
  };
  host.addEventListener('keydown', onKey);

  ctx.setPauseItems([{ id: 'restart', label: 'Restart run', onSelect: start }]);
  ctx.setView('menu');
  loop.start();

  if (ctx.run.mode === 'daily' || ctx.run.mode === 'challenge' || ctx.run.micro !== undefined) {
    start();
  }

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    gameMenu: () => {
      state = 'menu';
      ctx.setView('menu');
    },
    playAgain: start,
    leaveCheck: () => (state === 'play' && score > 0 ? 'would-lose-progress' : 'safe'),
    dispose: () => {
      loop.stop();
      host.removeEventListener('keydown', onKey);
      canvas.remove();
    },
  };
}

function demo(host: HTMLElement, _seed: number, context: DemoContext): DemoHandle {
  const surface = document.createElement('canvas');
  surface.width = WIDTH;
  surface.height = HEIGHT;
  host.append(surface);
  const drawing = surface.getContext('2d');
  let dark = context.appearance === 'dark';

  let basketX = WIDTH / 2;
  const basketWidth = 64;
  const dots: Dot[] = [{ x: WIDTH / 2, y: 20, vx: 20, vy: 160 }];
  let frame: number | null = null;
  let last = performance.now();

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Attract AI tracks the leading dot
    const target = dots[0]?.x ?? WIDTH / 2;
    const delta = Math.max(-280 * dt, Math.min(280 * dt, target - basketX));
    basketX += delta;

    for (let i = dots.length - 1; i >= 0; i--) {
      const dot = dots[i];
      if (dot === undefined) {
        continue;
      }
      dot.y += dot.vy * dt;
      if (dot.y > HEIGHT - 36) {
        dot.y = 20;
        dot.x = ((dot.x + 120) % (WIDTH - 60)) + 30;
      }
    }

    if (drawing) {
      drawGame(drawing, basketX, basketWidth, dots, 0, 0, 30, dark);
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
    pause: () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = null;
    },
    resume: () => {
      last = performance.now();
      frame ??= requestAnimationFrame(tick);
    },
    dispose: () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      surface.remove();
    },
  };
}

export const catchGame: GameModule = {
  manifest: catchManifest,
  patches,
  microChallenges,
  howToPlay: {
    goal: 'Catch falling dots in your basket. Survive 30 seconds without missing three.',
    controls: catchManifest.controls,
    tips: ['Watch the wind drift on breezy channels to predict where dots land.'],
  },
  mount,
  demo,
};
