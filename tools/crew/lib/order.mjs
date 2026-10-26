/**
 * Work orders: Markdown files in .team/orders/ with a small front matter block
 * (id, kind, model, fence, acceptance, reads) above the brief itself. This
 * module parses them and refuses anything the bridge must not run: unknown
 * kinds, non-Gemini models, and fences that reach into protected folders.
 */
import { basename } from 'node:path';

export const KINDS = ['engine', 'ai', 'dossier', 'tests', 'docs', 'data', 'plumbing'];

// The crew is Gemini only (CLAUDE.md rule 14). Claude and other models listed by
// `agy models` are refused even when an order or the command line asks for them.
export const ALLOWED_MODEL = /^gemini-[a-z0-9.-]+$/;

const HEAVY_MODEL = 'gemini-4-argon-medium';
const LIGHT_MODEL = 'gemini-3.8-flash-medium';

export const DEFAULT_MODEL_BY_KIND = {
  engine: HEAVY_MODEL,
  ai: HEAVY_MODEL,
  dossier: HEAVY_MODEL,
  tests: LIGHT_MODEL,
  docs: LIGHT_MODEL,
  data: LIGHT_MODEL,
  plumbing: LIGHT_MODEL,
};

const TIMEOUT_SECONDS_BY_KIND = { dossier: 900, engine: 1500 };
const DEFAULT_TIMEOUT_SECONDS = 600;

/**
 * Folders no fence may reach. original/ and src/ are the owner's reference
 * material; .team/ holds the orders and ledger the crew is judged by; the rest
 * is tooling the crew has no business changing.
 */
export const PROTECTED_ROOTS = ['original', 'src', '.git', '.claude', '.team', 'node_modules'];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;

/** Left out of the staging copy (see tree.mjs), so the crew cannot read them. */
const UNSEEN_ROOTS = ['.claude', '.team', '.git', 'node_modules'];

export function timeoutSecondsFor(kind) {
  return TIMEOUT_SECONDS_BY_KIND[kind] ?? DEFAULT_TIMEOUT_SECONDS;
}

/** Picks the model for a run and refuses anything that is not a Gemini model. */
export function resolveModel(order, override) {
  const model = override ?? order.model ?? DEFAULT_MODEL_BY_KIND[order.kind];
  if (!model || !ALLOWED_MODEL.test(model)) {
    throw new Error(`Model "${model}" is not allowed: the crew runs on gemini-* models only.`);
  }
  return model;
}

function unquote(value) {
  const trimmed = value.trim();
  const quoted = /^(["'])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

function stripComment(line) {
  return line.replace(/(^|\s+)#.*$/, '');
}

/**
 * Reads the front matter subset orders use: `key: value`, `key: [a, b]` and
 * `key:` followed by `  - item` lines. Anything fancier is an authoring error.
 */
export function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error('The order has no front matter block between --- lines.');
  const [, header, body] = match;
  const fields = {};
  let openList = null;
  for (const rawLine of header.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (line.trim() === '') continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (!openList) throw new Error(`List item without a key: "${rawLine.trim()}"`);
      fields[openList].push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) throw new Error(`Cannot read front matter line: "${rawLine.trim()}"`);
    const [, key, value] = pair;
    openList = null;
    if (value === '') {
      fields[key] = [];
      openList = key;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      fields[key] = inner === '' ? [] : inner.split(',').map(unquote);
    } else {
      fields[key] = unquote(value);
    }
  }
  return { fields, body };
}

export function parseOrder(text) {
  const { fields, body } = parseFrontMatter(text);
  const asList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
  return {
    id: fields.id,
    kind: fields.kind,
    model: fields.model,
    fence: asList(fields.fence),
    acceptance: asList(fields.acceptance),
    reads: asList(fields.reads),
    body: body.trim(),
  };
}

function isUnsafeRelativePath(path) {
  return (
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split('/').some((segment) => segment === '..' || segment === '.')
  );
}

function fenceProblem(glob) {
  if (isUnsafeRelativePath(glob)) return `fence "${glob}" must be a plain repo-relative path`;
  const root = glob.split('/')[0];
  if (PROTECTED_ROOTS.includes(root) || /^[*?{]/.test(root)) {
    return `fence "${glob}" reaches a protected or unanchored location`;
  }
  if (!glob.includes('/') && /[*?{]/.test(glob)) {
    return `fence "${glob}" is a wildcard at the repo root; name a folder`;
  }
  return null;
}

/** Returns every problem with an order; an empty list means it may run. */
export function validateOrder(order, fileName) {
  const problems = [];
  if (!order.id || !ID_PATTERN.test(order.id)) {
    problems.push('id must be 3–64 characters of lowercase letters, digits and dashes');
  } else if (fileName && basename(fileName, '.md') !== order.id) {
    problems.push(`file name must be ${order.id}.md`);
  }
  if (!KINDS.includes(order.kind)) problems.push(`kind must be one of ${KINDS.join(', ')}`);
  if (order.model !== undefined && !ALLOWED_MODEL.test(order.model)) {
    problems.push(`model "${order.model}" is not a gemini-* model`);
  }
  if (order.fence.length === 0) problems.push('fence must list at least one path');
  for (const glob of order.fence) {
    const problem = fenceProblem(glob);
    if (problem) problems.push(problem);
  }
  for (const path of order.reads) {
    if (isUnsafeRelativePath(path)) problems.push(`read "${path}" must be a repo-relative path`);
    // The staging copy leaves these out, and agy denies reads outside its workspace.
    else if (UNSEEN_ROOTS.includes(path.split('/')[0])) {
      problems.push(`read "${path}" is not visible to the crew; quote what it needs in the brief`);
    }
  }
  if (!/^## Goal\b/m.test(order.body)) problems.push('the brief needs a "## Goal" section');
  return problems;
}
