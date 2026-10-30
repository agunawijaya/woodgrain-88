/**
 * The crew's members: who can run a work order, and on which model. Agy has
 * always driven two Gemini models (argon for heavy kinds, flash for light
 * ones); from prompt 05 onward, opencode drives two DeepSeek models alongside
 * them. An order picks a member by name — in its front matter, or on the
 * command line, which wins. With neither, nothing changes from before this
 * file existed: the order runs on Agy, on the kind's default Gemini model (or
 * `--model`).
 */
import { ALLOWED_MODEL as AGY_ALLOWED_MODEL, resolveModel as resolveAgyModel } from './order.mjs';
import { ALLOWED_MODEL as OPENCODE_ALLOWED_MODEL } from './opencode.mjs';

export const MEMBERS = {
  'agy-argon': { runner: 'agy', model: 'gemini-4-argon-medium' },
  'agy-flash': { runner: 'agy', model: 'gemini-3.8-flash-medium' },
  'deepseek-pro': { runner: 'opencode', model: 'deepseek/deepseek-v4-pro' },
  'deepseek-flash': {
    runner: 'opencode',
    model: 'opencode/deepseek-v4.1-flash-free',
    freeTier: true,
  },
};

const ALLOWED_MODEL_BY_RUNNER = { agy: AGY_ALLOWED_MODEL, opencode: OPENCODE_ALLOWED_MODEL };

// The free tier reads nothing that could leak the reference dossiers: not the
// reference folders themselves, and not the notes an order writes about them.
const FREE_TIER_FORBIDDEN_READ_ROOTS = ['original', 'src', 'research'];

export function memberNames() {
  return Object.keys(MEMBERS);
}

export function isKnownMember(name) {
  return name !== undefined && Object.hasOwn(MEMBERS, name);
}

/**
 * Picks who runs an order: the member named on the command line or in its
 * front matter, or — with neither — the Agy runner on the kind's default
 * model, exactly as before members existed. A model override on a named
 * member may only pick another model allowed for that member's own runner.
 */
export function resolveRun(order, { memberOverride, modelOverride } = {}) {
  const name = memberOverride ?? order.member;
  if (name === undefined) {
    return { member: 'agy', runner: 'agy', model: resolveAgyModel(order, modelOverride) };
  }
  if (!isKnownMember(name)) {
    throw new Error(`Unknown crew member "${name}"; pick one of ${memberNames().join(', ')}.`);
  }
  const member = MEMBERS[name];
  const model = modelOverride ?? order.model ?? member.model;
  if (!ALLOWED_MODEL_BY_RUNNER[member.runner].test(model)) {
    throw new Error(`Model "${model}" is not allowed for member "${name}".`);
  }
  return { member: name, runner: member.runner, model };
}

/** Problems a static read of the order can already catch, before any run. */
export function validateMember(order) {
  const problems = [];
  if (order.member === undefined) return problems;
  if (!isKnownMember(order.member)) {
    problems.push(`member "${order.member}" is not one of ${memberNames().join(', ')}`);
    return problems;
  }
  const member = MEMBERS[order.member];
  if (order.model !== undefined && !ALLOWED_MODEL_BY_RUNNER[member.runner].test(order.model)) {
    problems.push(`model "${order.model}" is not allowed for member "${order.member}"`);
  }
  if (member.freeTier) {
    for (const path of order.reads) {
      if (FREE_TIER_FORBIDDEN_READ_ROOTS.includes(path.split('/')[0])) {
        problems.push(`read "${path}" is not allowed for the free-tier member "${order.member}"`);
      }
    }
  }
  return problems;
}
