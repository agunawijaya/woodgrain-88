/**
 * The crew's rules in agy's own settings. In headless mode agy runs a command
 * only when a `permissions.allow` rule in the user's settings file matches it;
 * a project-level settings file is ignored (verified on agy 1.4.7). So
 * `crew allow` merges the check-command rules into that file. Rules the owner
 * added for other projects are kept as they are.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { agyAllowRules } from './commands.mjs';

export const AGY_SETTINGS_FILE = join(homedir(), '.gemini', 'antigravity-cli', 'settings.json');

// Every crew command starts `pnpm exec`, so a rule in this form is the bridge's.
const CREW_RULE = /^command\(regex:pnpm exec /;

/** The settings with the crew's rules brought up to date and everything else untouched. */
export function withCrewRules(settings) {
  const permissions = settings.permissions ?? {};
  const others = (permissions.allow ?? []).filter((rule) => !CREW_RULE.test(rule));
  return { ...settings, permissions: { ...permissions, allow: [...others, ...agyAllowRules()] } };
}

export function missingCrewRules(settings) {
  const allowed = new Set(settings.permissions?.allow ?? []);
  return agyAllowRules().filter((rule) => !allowed.has(rule));
}

export function readAgySettings(file = AGY_SETTINGS_FILE) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

export function installCrewRules(file = AGY_SETTINGS_FILE) {
  const before = readAgySettings(file);
  writeFileSync(file, `${JSON.stringify(withCrewRules(before), null, 2)}\n`);
  return { file, rules: agyAllowRules().length, added: missingCrewRules(before) };
}
