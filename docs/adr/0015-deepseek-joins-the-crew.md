# ADR-0015 — DeepSeek joins the crew

- Status: accepted
- Date: 2026-10-30 (prompt 05, stage 0)
- Code: `tools/crew/lib/members.mjs`, `tools/crew/lib/opencode.mjs`, `tools/crew/lib/run.mjs`;
  protocol in `docs/team/PROTOCOL.md`

## Context

The crew bridge (ADR-0007) drove one external runner, Agy, on two Gemini models. Quota is per
model family, and Gemini 4 Argon ran out again at the start of prompt 05 (reset in about 129
hours), leaving only the light Gemini model for heavy orders. The owner added DeepSeek through the
OpenCode CLI (`opencode` 2.2.2) so that no single quota decides the schedule, and so that
algorithm-heavy work (fixed-step physics, simulations, engine reviews) has a strong model behind it.

## What we verified on this machine (OpenCode 2.2.2, 2026-10-30)

| Question                      | Finding                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which models?                 | `opencode models` lists `deepseek/deepseek-v4-pro` and `opencode/deepseek-v4.1-flash-free`.                                                                                                                                               |
| Headless output?              | `opencode run --format json "<message>"` prints JSON Lines: `step_start`, `text`, `tool_use` (with each call's status and error) and `step_finish` (with that step's tokens). Usage is per run, not cumulative.                           |
| Default permissions?          | **Everything is allowed** by the built-in agent. Rules come only from an `opencode.json` in the working directory; for `edit`, `bash` and `external_directory` they are wildcard maps where the last match wins.                          |
| What does a refusal do?       | The tool call comes back to the model as `Permission denied: <action>` and the turn **carries on** (unlike Agy, where a denial ends the turn).                                                                                            |
| Is the config read every run? | **No.** The background service remembers a folder's config the first time it sees it. `--standalone` (a private server per run) reads it fresh.                                                                                           |
| Which folder does it work in? | **`PWD`, not the process's own directory.** Launched from the repo root with only `cwd` set to a staging copy, a live check edited the real README (the model put it back) and ignored the copy's permission file. The bridge sets `PWD`. |
| Does it read stdin?           | **Yes, to the end, when stdin is not a terminal.** An open pipe held a one-word turn until the pipe closed; the bridge closes stdin at once.                                                                                              |
| A top-level `"*": "deny"`?    | Hung the run until the timeout. The bridge lists the actions instead.                                                                                                                                                                     |
| Windows launch?               | `opencode` on the PATH is npm's shim, which `spawn` cannot start without a shell; the bridge finds the `opencode.exe` beside it.                                                                                                          |

## Decision

- **Members, not just models.** An order names a member (`agy-argon`, `agy-flash`, `deepseek-pro`,
  `deepseek-flash`) in front matter or with `--member`; with neither, it runs on Agy by kind as
  before. A follow-up always continues on the member that started the order.
- **Pinned to DeepSeek.** The OpenCode runner accepts only `deepseek/…` and `opencode/deepseek-…`
  model ids, checked when the order is resolved and again where the arguments are built. Agy stays
  pinned to Gemini. Neither runner ever passes `--auto`, `--dangerously-skip-permissions` or any
  other permission-skipping flag.
- **The same order, staging copy, fence check, acceptance and ledger for both runners.** For
  OpenCode the bridge writes `opencode.json` into the staging copy: edits only inside the fence;
  in the shell only the crew's check commands and Vitest, with chaining, redirection, substitution,
  `..`, git, deletes and downloads denied after the allows; no web tools, subagents, questions or
  to-do lists; no directories outside the copy except the order's reference files. It runs with
  `--standalone`, `PWD` set to the copy, stdin closed, `GIT_DIR` and `GIT_CEILING_DIRECTORIES`
  pointing away from the real repository, and a timeout that kills the whole process tree. The
  fence check afterwards is the backstop, exactly as for Agy.
- **The free tier never sees the reference material.** Orders for `deepseek-flash` may not read
  `original/`, `src/` or `research/`, and its staging copy leaves out `research/`.
- **`crew ping` reports every member**: both Gemini models, both DeepSeek models (listed and a
  no-tool READY turn) and the engineer and qa-scout subagents.

## Consequences

- Heavy orders no longer wait on one quota: DeepSeek Pro takes physics and engine work while Argon
  is blocked.
- DeepSeek members may run tests themselves, so an order's Vitest acceptance can pass on round one.
- OpenCode's permission file is the only thing between a member and the machine; it is covered by
  `tools/crew/tests/opencode.test.mjs`, the run tests (fence rejection, stdin, `PWD`, timeout and
  tree kill, follow-up resume) and the live check `crew-deepseek-live-check` in the ledger (write
  inside the fence applied; README edit and `git status` refused).
