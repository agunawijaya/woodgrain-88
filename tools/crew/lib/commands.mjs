/**
 * The check commands the crew may run itself: lint, format check and
 * typecheck, each in one fixed shape with only plain repo paths after it.
 *
 * Only checks that read. agy's sandbox refuses every write from a command on
 * Windows, whatever write grant the settings give, and Vitest 5 cannot start
 * without writing (its config bundle and an API token), so tests stay with the
 * bridge's acceptance run (verified on agy 1.4.7, 2026-10-27).
 *
 * Two places enforce the same list. agy's own permission rules (written into
 * the user's agy settings by `crew allow`) are what let a command run at all in
 * headless mode; the bridge's PreToolUse hook (gate.mjs) refuses everything
 * else with a reason, so a wrong command costs the crew a retry instead of
 * ending its turn. Both are generated from CREW_COMMANDS so they cannot drift.
 *
 * agy matches a regex rule token by token, anchored, with the token count fixed
 * (verified on agy 1.4.7), so each shape becomes one rule per argument count.
 */

// A repo-relative path: no drive letter, no leading slash or dot, and never
// two dots in a row, so `..` cannot climb out of the workspace.
const PATH_TOKEN = '[A-Za-z0-9_-][A-Za-z0-9_/-]*(\\.[A-Za-z0-9_/-]+)*';
const MAX_PATHS = 4;

const literal = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Each shape: the fixed words, then between minPaths and maxPaths path tokens. */
export const CREW_COMMANDS = [
  { words: ['pnpm', 'exec', 'eslint'], minPaths: 1 },
  { words: ['pnpm', 'exec', 'prettier', '--check'], minPaths: 1 },
  { words: ['pnpm', 'exec', 'tsc', '-p'], minPaths: 1, maxPaths: 1 },
];

/** Every command shape spelled out as token patterns, one entry per path count. */
function expandShapes() {
  const shapes = [];
  for (const shape of CREW_COMMANDS) {
    const fixed = shape.words.map(literal);
    for (let paths = shape.minPaths; paths <= (shape.maxPaths ?? MAX_PATHS); paths += 1) {
      shapes.push([...fixed, ...Array.from({ length: paths }, () => PATH_TOKEN)]);
    }
  }
  return shapes;
}

const SHAPES = expandShapes();

/** The rules for agy's `permissions.allow`, in its `command(regex:...)` syntax. */
export function agyAllowRules() {
  return SHAPES.map((tokens) => `command(regex:${tokens.join(' ')})`);
}

/** Shell syntax that could chain, redirect, substitute or glob; none of our shapes need it. */
const SHELL_SYNTAX = /[&|;<>$`()'"*?!%^\\\r\n]/;

/** Whether a command line is exactly one of the crew's check commands. */
export function isCrewCommand(commandLine) {
  const line = commandLine.trim();
  if (line === '' || SHELL_SYNTAX.test(line)) return false;
  const tokens = line.split(/\s+/);
  return SHAPES.some(
    (shape) =>
      shape.length === tokens.length &&
      shape.every((pattern, index) => new RegExp(`^(?:${pattern})$`).test(tokens[index])),
  );
}

/** One line per shape, for the crew's prompt and the refusal message. */
export function describeCrewCommands() {
  return CREW_COMMANDS.map((shape) => {
    const paths = shape.maxPaths === 1 ? '<path>' : `<path> (up to ${MAX_PATHS})`;
    return `${shape.words.join(' ')} ${paths}`;
  });
}
