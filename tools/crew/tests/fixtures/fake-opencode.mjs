/**
 * A stand-in for the OpenCode CLI so bridge tests never reach a model.
 * FAKE_OPENCODE_SCENARIO picks the behaviour; every call appends its
 * arguments to FAKE_OPENCODE_LOG, and the `opencode.json` found in the
 * working directory is copied beside it, so tests can assert both what the
 * bridge passed and what it allowed.
 */
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const scenario = process.env.FAKE_OPENCODE_SCENARIO ?? 'inside';
const realRepo = process.env.FAKE_OPENCODE_REAL_REPO;

if (process.env.FAKE_OPENCODE_LOG) {
  appendFileSync(process.env.FAKE_OPENCODE_LOG, `${JSON.stringify(args)}\n`);
}
if (process.env.FAKE_OPENCODE_CONFIG_LOG && existsSync('opencode.json')) {
  copyFileSync('opencode.json', process.env.FAKE_OPENCODE_CONFIG_LOG);
}
if (process.env.FAKE_OPENCODE_PWD_LOG) {
  writeFileSync(process.env.FAKE_OPENCODE_PWD_LOG, `${process.env.PWD ?? ''}\n${process.cwd()}`);
}
if (process.env.FAKE_OPENCODE_LISTING) {
  writeFileSync(process.env.FAKE_OPENCODE_LISTING, readdirSync('.').sort().join(','));
}

function write(rel, text) {
  mkdirSync(dirname(rel), { recursive: true });
  writeFileSync(rel, text);
}

function line(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function succeed({ text = 'Done.', sessionId = 'ses_123' } = {}) {
  const report =
    '```json\n{"filesChanged": ["docs/notes.md"], "testsWritten": [], "assumptions": [], "openQuestions": []}\n```';
  line({ type: 'step_start', sessionID: sessionId });
  line({ type: 'text', sessionID: sessionId, part: { text: `${text}\n\n${report}\n` } });
  line({
    type: 'step_finish',
    sessionID: sessionId,
    part: {
      tokens: { input: 1000, output: 200, reasoning: 50, cache: { read: 0, write: 0 } },
      cost: 0,
    },
  });
}

/** Like the real CLI, waits for stdin to close before it answers when stdin is not a terminal. */
function afterStdinCloses(then) {
  process.stdin.resume();
  process.stdin.on('end', then);
}

function callCount() {
  const counter = process.env.FAKE_OPENCODE_COUNTER;
  const previous = counter && existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
  if (counter) writeFileSync(counter, String(previous + 1));
  return previous + 1;
}

if (args[0] === 'models') {
  process.stdout.write(
    'deepseek/deepseek-v4-pro\tDeepSeek V4 Pro\nopencode/deepseek-v4.1-flash-free\tDeepSeek V4.1 Flash (free)\n',
  );
  process.exit(0);
}

switch (scenario) {
  case 'waits-for-stdin':
    afterStdinCloses(() => {
      write('docs/notes.md', 'crew notes\n');
      succeed();
    });
    break;
  case 'inside':
    write('docs/notes.md', 'crew notes\n');
    succeed();
    break;
  case 'outside':
    write('docs/notes.md', 'crew notes\n');
    write('hall/sneaky.ts', 'export {};\n');
    write('README.md', 'rewritten by the crew\n');
    succeed();
    break;
  case 'conflict':
    write('docs/notes.md', 'crew notes\n');
    writeFileSync(join(realRepo, 'docs', 'notes.md'), 'the lead edited this meanwhile\n');
    succeed();
    break;
  case 'denied-but-applied':
    write('docs/notes.md', 'crew notes\n');
    line({ type: 'step_start', sessionID: 'ses_denied' });
    line({
      type: 'tool_use',
      sessionID: 'ses_denied',
      part: {
        tool: 'write',
        state: { status: 'error', error: 'Permission denied: edit outside the fence' },
      },
    });
    line({
      type: 'text',
      sessionID: 'ses_denied',
      part: {
        text: 'Done, with one refusal.\n\n```json\n{"filesChanged": ["docs/notes.md"], "testsWritten": [], "assumptions": [], "openQuestions": []}\n```\n',
      },
    });
    line({
      type: 'step_finish',
      sessionID: 'ses_denied',
      part: { tokens: { input: 500, output: 100, reasoning: 0, cache: { read: 0, write: 0 } } },
    });
    break;
  case 'quota':
    process.stderr.write('Error: 429 rate limit exceeded for this account\n');
    process.exit(1);
    break;
  case 'transport-once':
    if (callCount() === 1) {
      process.stderr.write('connection reset\n');
      process.exit(1);
    }
    write('docs/notes.md', 'crew notes\n');
    succeed();
    break;
  case 'transport-always':
    callCount();
    process.stderr.write('connection reset\n');
    process.exit(1);
    break;
  case 'garbage':
    process.stdout.write('not json at all\nstill not json\n');
    process.exit(0);
    break;
  case 'crew-error':
    line({ type: 'error', sessionID: 'ses_err', part: { message: 'the model gave up' } });
    break;
  case 'never-exits':
    // Deliberately hangs; the bridge's tree-kill is what ends this process.
    setInterval(() => process.stdout.write(''), 1000);
    break;
  case 'ready':
    succeed({ text: 'READY' });
    break;
  default:
    process.stderr.write(`unknown scenario ${scenario}\n`);
    process.exit(2);
}
