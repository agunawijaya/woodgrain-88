/**
 * A stand-in for the Antigravity CLI so bridge tests never reach the network.
 * FAKE_AGY_SCENARIO picks the behaviour; every call appends its arguments to
 * FAKE_AGY_LOG so tests can assert exactly what the bridge passed.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const scenario = process.env.FAKE_AGY_SCENARIO ?? 'inside';
const realRepo = process.env.FAKE_AGY_REAL_REPO;

if (process.env.FAKE_AGY_LOG) appendFileSync(process.env.FAKE_AGY_LOG, `${JSON.stringify(args)}\n`);

function write(rel, text) {
  mkdirSync(dirname(rel), { recursive: true });
  writeFileSync(rel, text);
}

function succeed(extra = {}) {
  const report =
    '```json\n{"filesChanged": ["docs/notes.md"], "testsWritten": [], "assumptions": [], "openQuestions": []}\n```';
  process.stdout.write(
    JSON.stringify({
      conversation_id: 'conv-123',
      status: 'SUCCESS',
      response: `Done.\n\n${report}\n`,
      duration_seconds: 1.5,
      num_turns: 2,
      usage: {
        input_tokens: 1000,
        output_tokens: 200,
        thinking_tokens: 50,
        cache_read_tokens: 0,
        total_tokens: 1250,
      },
      ...extra,
    }),
  );
}

function callCount() {
  const counter = process.env.FAKE_AGY_COUNTER;
  const previous = counter && existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
  if (counter) writeFileSync(counter, String(previous + 1));
  return previous + 1;
}

if (args[0] === 'models') {
  process.stdout.write(
    'gemini-4-argon-medium\tGemini 4 Argon (Medium)\nclaude-opus-5-5-high\tClaude\n',
  );
  process.exit(0);
}

switch (scenario) {
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
  case 'delete':
    rmSync('docs/old.md', { force: true });
    succeed();
    break;
  case 'protected': {
    const addDir = args[args.indexOf('--add-dir') + 1];
    writeFileSync(join(addDir, 'game.asm'), 'tampered\n');
    writeFileSync(join(addDir, 'new-file.txt'), 'should not exist\n');
    write('docs/notes.md', 'crew notes\n');
    succeed();
    break;
  }
  case 'conflict':
    write('docs/notes.md', 'crew notes\n');
    writeFileSync(join(realRepo, 'docs', 'notes.md'), 'the lead edited this meanwhile\n');
    succeed();
    break;
  case 'quota':
    process.stderr.write('Error: RESOURCE_EXHAUSTED: quota exceeded for this account\n');
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
  case 'crew-error':
    process.stdout.write(
      JSON.stringify({ conversation_id: 'conv-err', status: 'ERROR', response: '', usage: {} }),
    );
    break;
  case 'denied':
    process.stdout.write(
      JSON.stringify({
        conversation_id: 'conv-denied',
        status: 'SUCCESS',
        response: '',
        usage: { total_tokens: 900 },
        denied_actions: [{ action: 'read_file', display_name: 'ReadFile' }],
      }),
    );
    break;
  case 'ready':
    succeed({ response: 'READY' });
    break;
  default:
    process.stderr.write(`unknown scenario ${scenario}\n`);
    process.exit(2);
}
