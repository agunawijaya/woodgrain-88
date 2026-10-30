# Brief: an OpenCode runner for the crew bridge (prompt 05, stage 0)

**For:** engineer. **From:** the lead (who owns the crew bridge this wave). **Tests run by:** qa-scout.

## Goal

`pnpm crew` gains two members that run DeepSeek models headless through the OpenCode CLI, beside
the two Agy (Gemini) members it already drives. Same orders, same staging copy, same fence check,
same acceptance run, same ledger; only the runner differs. Nothing about Agy runs changes.

```
pnpm crew dispatch <order.md> --member agy-argon|agy-flash|deepseek-pro|deepseek-flash
pnpm crew followup <order-id> "<notes>"     (resumes on the member that started the order)
pnpm crew status
pnpm crew ping                              (every member, see below)
```

## Read first

`tools/crew/crew.mjs`, every file in `tools/crew/lib/`, `tools/crew/tests/*` (especially
`run.test.mjs` and `fixtures/fake-agy.mjs`), `docs/team/PROTOCOL.md`, `docs/team/CREW.md`,
`docs/adr/0007-crew-bridge.md`. Match their style exactly: plain ESM `.mjs`, a top comment saying
what the module is for and why, small functions, comments that explain why, `node:test` tests.

## What the lead verified on this machine (OpenCode v2.2.2, 2026-10-30)

- Models: `deepseek/deepseek-v4-pro` and `opencode/deepseek-v4.1-flash-free` (from `opencode models`).
- `opencode run --model <id> --format json "<message>"` prints JSON Lines, one event per line:
  `{"type":"step_start"|"text"|"tool_use"|"step_finish"|..., "sessionID":"ses_...", "part":{...}}`.
  - `text` events: `part.text` is a piece of the reply. The final reply is the `text` parts in order.
  - `tool_use` events: `part.tool` (`write`, `edit`, `read`, `shell`, ...), `part.state.status`
    (`completed` | `error`), `part.state.error` (a denied call reads `"Permission denied: <action>"`).
  - `step_finish` events: `part.tokens = { input, output, reasoning, cache: { read, write } }` and
    `part.cost`. Tokens are per step; a run's usage is the sum of its steps (a follow-up run reports
    only its own steps, so no subtraction is needed).
- **Out of the box OpenCode allows every action.** Its permission rules come from an `opencode.json`
  in the working directory, in this shape (keys are actions; for `edit`, `bash` and
  `external_directory` the value may be a map of wildcard patterns, `*` = any characters; the last
  matching rule wins):
  ```json
  {
    "permission": {
      "edit": { "*": "deny", "games/x/**": "allow" },
      "bash": { "*": "deny", "pnpm exec vitest run *": "allow" },
      "webfetch": "deny",
      "websearch": "deny",
      "external_directory": "deny"
    }
  }
  ```
  A denied call comes back to the model as an error and the turn carries on (unlike Agy, a denial
  does not end the turn).
- **OpenCode's background service caches a directory's config the first time it sees it**, so a
  changed `opencode.json` in a reused folder is ignored. Always pass `--standalone` (a private
  server for this run, which reads the config fresh). With `--standalone` a `"bash": {"*": "deny"}`
  rule refused `git status` as expected.
- A config with a top-level `"*": "deny"` hung the run until the timeout (the model could not even
  answer). Never use a top-level catch-all; list the actions instead.
- `--session <id>` continues a session (follow-ups).

## Behaviour (numbered; each is a test or an obvious read)

### Members and models

1. A member registry in `tools/crew/lib/members.mjs`:
   - `agy-argon` → runner `agy`, model `gemini-4-argon-medium`;
   - `agy-flash` → runner `agy`, model `gemini-3.8-flash-medium`;
   - `deepseek-pro` → runner `opencode`, model `deepseek/deepseek-v4-pro`;
   - `deepseek-flash` → runner `opencode`, model `opencode/deepseek-v4.1-flash-free`, `freeTier: true`.
2. An order may name its member in front matter (`member: deepseek-pro`); `--member` on the command
   line overrides it. With neither, today's behaviour stays: the Agy model by kind (or `--model`).
   `--model` with an opencode member may only pick another allowed DeepSeek id.
3. **Pinning.** The opencode runner refuses any model that does not match
   `^deepseek\/[a-z0-9.-]+$` or `^opencode\/deepseek-[a-z0-9.-]+$` (never Claude, never anything
   else), in `resolveModel` and again where the arguments are built, exactly as Agy's
   `ALLOWED_MODEL` is checked twice today. The Agy side keeps refusing non-Gemini models.
4. Timeouts by kind stay as they are for both runners.

### The opencode runner (`tools/crew/lib/opencode.mjs`, mirroring `agy.mjs`)

5. `resolveOpencodeCommand(env)`: `opencode`, or `CREW_OPENCODE` (a `.mjs` script runs through
   `node`, for tests), like `resolveAgyCommand`.
6. `buildOpencodeArgs({ prompt, model, sessionId })` returns exactly
   `['run', '--standalone', '--model', model, '--format', 'json', ...(sessionId ? ['--session', sessionId] : []), prompt]`.
   It never passes `--auto` or any permission-skipping flag, and throws if one ever appears.
   The prompt limit (`MAX_PROMPT_CHARS`) applies as for Agy.
7. `writeOpencodeConfig(stagingDir, { fence, referenceFiles, runner })` writes `opencode.json` into
   the staging copy before the run:
   - `edit`: `{ "*": "deny" }` then one `"allow"` per fence entry, as written in the order;
   - `bash`: `{ "*": "deny" }`, then `"allow"` for each crew check shape (from `CREW_COMMANDS` in
     `commands.mjs`, written as `"<words> *"`, for example `"pnpm exec eslint *"`), plus
     `"pnpm exec vitest run *"` for opencode members only (OpenCode has no sandbox that stops Vitest
     writing its cache, so tests can run there), then `"deny"` for any command containing shell
     syntax, as patterns placed after the allows: `"*&*"`, `"*|*"`, `"*;*"`, `"*>*"`, `"*<*"`,
     ``"*`*"``, `"*$*"`, `"*..*"`, `"git *"`, `"rm *"`, `"del *"`, `"curl *"`, `"wget *"`;
   - `webfetch`, `websearch`, `task`, `question` and `todowrite`: `"deny"` (no network, no
     subagents, nobody to answer a question in a headless run);
   - `external_directory`: `{ "*": "deny" }` then `"allow"` for each reference file's absolute path
     (the order's reads under `src/` or `original/`, from `splitReads`).
     Keep the comment in this module that says why each line is there.
8. After the run and **before** `enforceFence`, the bridge removes `opencode.json` and any
   `.opencode/` folder from the staging copy, so they never count as crew changes. The baseline
   hashes never contain them.
9. The opencode process gets `GIT_DIR` pointing at a path that does not exist inside the staging
   copy (for example `<staging>/.no-git`) and `GIT_CEILING_DIRECTORIES` set to the staging copy's
   parent, so a stray git command can never reach the real repository above it.
10. A run that outlives its timeout plus the grace period is killed **with its process tree**
    (`taskkill /PID <pid> /T /F` on Windows, `process.kill(-pid)` with `detached` elsewhere), because
    `--standalone` starts a private server under the client. Add this as an option of
    `runProcess` used only by the opencode runner; Agy's behaviour does not change.
11. `interpretOpencodeRun(run)` sorts a finished process into the same outcomes as `interpretRun`
    (`ok`, `crew-error`, `quota`, `timeout`, `transport`), from the JSON Lines:
    - `timeout` when the bridge killed it;
    - `quota` when stderr or an error event matches quota, rate limit, 429, 402 or insufficient
      balance;
    - `transport` when it could not start or printed no parsable event;
    - `crew-error` when an `error` event appears or the exit code is non-zero;
    - `ok` otherwise. The result carries `sessionId`, `response` (the text parts joined),
      `usage` (summed `step_finish` tokens mapped to the ledger's `{ input, output, thinking,
cacheRead, total }`, with `thinking` = reasoning and `total` = input + output + reasoning),
      and `deniedActions` (each tool call whose error starts `Permission denied`, as
      `{ tool, error }`).
      Unparsable lines are skipped, not fatal.
12. Because an OpenCode denial does not end the turn, a round with denied actions and applied
    changes is reviewed like any other; `denied` status only when nothing was applied, as today.

### Data rule for the free tier

13. `validateOrder` refuses an order for a `freeTier` member whose `reads` include anything under
    `original/`, `src/` or `research/`.
14. The staging copy for a `freeTier` member also leaves out `research/` (its excluded roots are
    `STAGING_EXCLUDED_ROOTS` plus `research`), so the model cannot read the dossiers by browsing.

### Dispatch, follow-up, ledger, report

15. `executeRound` picks the runner from the member: Agy exactly as today; opencode with the config
    (7), environment (9), tree-kill (10) and its own interpreter (11). Raw stdout/stderr go to
    `round-N/opencode-stdout.jsonl` and `round-N/opencode-stderr.txt`.
16. The round, the state file and the ledger record the **member** as well as the model. The
    rendered `.team/LEDGER.md` gains a Member column; old entries without a member show `agy` (the
    only runner before today).
17. `followUp` resumes with the member and model the order started on, passing `--session` with
    the saved session id for opencode. A member override on a follow-up is an error.
18. `report.md` names the member.

### Ping and status

19. `pnpm crew ping` reports every member: for each Agy model as today; for each DeepSeek member,
    that its id is listed by `opencode models` and that a no-tool turn (in
    `.team/worktrees/_ping-opencode/`, with an `opencode.json` denying `edit`, `bash`, `webfetch`,
    `websearch`, `task`, `question`, `todowrite`) replies READY; and the two subagents as
    `available` when `~/.claude/agents/engineer.md` and `~/.claude/agents/qa-scout.md` exist. `ok`
    is true only when every member is ready; the JSON keeps today's fields and adds
    `members: { "agy-argon": "...", "agy-flash": "...", "deepseek-pro": "...", "deepseek-flash": "...", "engineer": "...", "qa-scout": "..." }`.
20. `pnpm crew status` lists each order's member.

## Tests (node:test, beside the existing ones; a `fixtures/fake-opencode.mjs` like `fake-agy.mjs`)

The fake prints JSON Lines and writes files according to `FAKE_OPENCODE_SCENARIO`, and logs its
arguments and the `opencode.json` it found in its working directory.

- `members.test.mjs` / order tests: the registry; `member:` in front matter and `--member` override;
  a Claude, Gemini or unknown model refused for an opencode member (and a DeepSeek model refused for
  an Agy member); free-tier orders reading `src/`, `original/` or `research/` refused.
- `opencode.test.mjs`: exact arguments, with and without a session; `--auto` never present; the
  written `opencode.json` (fence globs, check commands, vitest for opencode, the shell-syntax
  denials after the allows, the denied tools, reference files allowed in `external_directory`);
  `interpretOpencodeRun` on success, error event, quota text, timeout, garbage output; token sums;
  denied actions.
- `run.test.mjs` additions, against the fake in a throwaway repo:
  - a change inside the fence is applied, one outside it lands in `rejected/` (fence rejection);
  - `opencode.json` and `.opencode/` never appear as applied or rejected changes;
  - a free-tier staging copy has no `research/`;
  - follow-up resumes with `--session <the id from round 1>` on the same member;
  - a scenario that never exits is killed at the timeout (use a tiny timeout through an env
    override or a test hook; keep the test under a few seconds) and the round is `timeout`;
  - the ledger entry and `LEDGER.md` show the member.
- `pnpm test:crew` stays green, including every existing test.

## Docs (the lead rewrites the prose afterwards; write accurate drafts)

- `tools/crew/README.md`: the members and the new flags.
- Do **not** edit `CLAUDE.md`, `AGENTS.md`, `docs/team/*` or the ADRs; the lead writes those.

## Fence

You may change: `tools/crew/**`, `package.json` (only if a script needs a flag; avoid if you can).
Nothing else. No new dependencies. No git beyond reading. Do not run real `agy` or `opencode`
commands that reach a model; the lead does the live checks. Do not stop processes you did not
start.

## Report back

What you changed, file by file; how each numbered behaviour is met (or where you deviated and why);
the exact `pnpm test:crew` output summary; anything you were unsure of.
