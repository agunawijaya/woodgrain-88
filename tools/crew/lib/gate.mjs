/**
 * agy's PreToolUse hook for crew runs. agy sends the pending tool call as JSON
 * on stdin and reads a decision from stdout. Check commands pass; anything else
 * is refused with the list of what may run, which agy hands back to the model.
 * A refusal from here lets the crew carry on, where agy's own headless denial
 * would end its turn.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describeCrewCommands, isCrewCommand } from './commands.mjs';

export function decide(payload) {
  const args = payload?.toolCall?.args ?? {};
  const commandLine = String(args.CommandLine ?? '');
  // agy lets the model ask for a command outside its sandbox, which would lift
  // the sandbox's hold on writes; the crew's checks run inside it or not at all.
  if (args.BypassSandbox === true) {
    return {
      decision: 'deny',
      reason:
        'The crew bridge refused to run a command outside the sandbox. Run it again inside the sandbox; if it still fails, say so in your report.',
    };
  }
  if (isCrewCommand(commandLine)) return { decision: 'allow' };
  return {
    decision: 'deny',
    reason: [
      `The crew bridge refused "${commandLine.trim()}".`,
      'Only these check commands may run, one per call, exactly in this form:',
      ...describeCrewCommands().map((line) => `- ${line}`),
      'Edit files with your file tools; never chain, redirect or wrap commands.',
      'This refusal does not end your turn: carry on with one of the forms above.',
      'Your working directory is a full copy of the repo; read files there with relative paths. A read outside it ends your turn.',
    ].join('\n'),
  };
}

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return undefined;
  }
}

const runAsHook = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runAsHook) process.stdout.write(JSON.stringify(decide(readPayload())));
