---
id: 0001-crew-readme
kind: docs
fence:
  - tools/crew/README.md
acceptance:
  - node -e "const t = require('fs').readFileSync('tools/crew/README.md', 'utf8'); for (const h of ['## Commands', '## How a round works', '## Files', '## Testing the bridge']) if (!t.includes(h)) { console.error('missing ' + h); process.exit(1); }"
reads:
  - tools/crew/crew.mjs
  - tools/crew/lib/run.mjs
  - tools/crew/lib/order.mjs
  - tools/crew/lib/fence.mjs
  - tools/crew/lib/agy.mjs
  - docs/team/PROTOCOL.md
---

## Goal

Write `tools/crew/README.md`: a short, practical README for the crew bridge, for a programmer who
opens the folder and wants to know what it is, how to run it and how it is tested.

## Context

The bridge is already written and tested. `docs/team/PROTOCOL.md` is the full guide for leads; the
README must not repeat it, only point to it. Read the source files listed above so every statement
in the README is true of the code.

## Behaviour and edge cases

1. Open with one paragraph: what the bridge is for (a Claude Code lead hands routine work to Gemini
   models in the Antigravity CLI; the owner never relays messages).
2. `## Commands` — a table of the five commands (`dispatch`, `followup`, `review`, `status`,
   `ping`) with one line each, run as `pnpm crew <command>` or `node tools/crew/crew.mjs <command>`.
3. `## How a round works` — a numbered list of the steps `executeRound` in `lib/run.mjs` performs, in
   order, in plain words (staging copy, agy run, fence sorting, protected-folder restore, acceptance,
   report, ledger). Mention that the crew cannot run shell commands in headless accept-edits mode,
   so the bridge runs acceptance.
4. `## Files` — what lives in `tools/crew/lib/` (one line per module) and where runs, orders and the
   ledger are written.
5. `## Testing the bridge` — the tests use Node's built-in runner and a fake `agy` script selected
   with the `CREW_AGY` environment variable; give the command `node --test "tools/crew/tests/*.test.mjs"`.
6. End with a link to `docs/team/PROTOCOL.md` and `docs/adr/0007-crew-bridge.md`.
7. Under 120 lines. Plain English, no marketing tone, no emojis.

## Tests required

None; the acceptance command checks the four headings.

## Out of scope

Any change to the bridge code, the protocol or other docs.
