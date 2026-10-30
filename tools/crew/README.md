# Crew Bridge

The crew bridge allows a Claude Code lead to hand routine development tasks to the crew — Gemini models running in the Antigravity CLI (`agy`), and, from prompt 05 onward, DeepSeek models running in the OpenCode CLI (`opencode`) — without requiring the owner to manually relay prompts or responses. The lead specifies work orders with strict write fences and testable criteria, and the bridge manages execution, staging isolation, fence verification, acceptance testing, and ledger tracking. Only the runner differs between members; the order, the staging copy, the fence check, the acceptance run and the ledger are the same for all of them.

## Members

| Member           | Runner     | Model                               | Notes                                                                                                                   |
| ---------------- | ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `agy-argon`      | `agy`      | `gemini-4-argon-medium`             | The heavy default (engine, ai, dossier kinds).                                                                          |
| `agy-flash`      | `agy`      | `gemini-3.8-flash-medium`           | The light default (tests, docs, data, plumbing kinds).                                                                  |
| `deepseek-pro`   | `opencode` | `deepseek/deepseek-v4-pro`          |                                                                                                                         |
| `deepseek-flash` | `opencode` | `opencode/deepseek-v4.1-flash-free` | Free tier: its orders may not read `original/`, `src/` or `research/`, and its staging copy never contains `research/`. |

An order picks its member in front matter (`member: deepseek-pro`); `--member` on the command line overrides it. With neither, nothing changes from before members existed: the order runs on Agy, on the kind's default Gemini model (or `--model`). A follow-up always resumes on the member that started the order; it cannot override it.

## Commands

Run commands as `pnpm crew <command>` or `node tools/crew/crew.mjs <command>`:

| Command                                                   | Description                                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `dispatch <order.md> [--member <name>] [--model <model>]` | Dispatches a new work order, creating a staging copy and executing the first round.                                                    |
| `followup <order-id> "<notes>"`                           | Resumes an existing order conversation with corrective guidance (up to 3 follow-ups).                                                  |
| `review <order-id> [options]`                             | Records final verdict (`accepted`, `rejected`, `taken-over`) and token estimates in the ledger.                                        |
| `status`                                                  | Reports current status, round counts, members, models, and token metrics across all orders.                                            |
| `ping`                                                    | Checks every member: both Agy models, both DeepSeek models (listed and a no-tool READY turn), and the `engineer`/`qa-scout` subagents. |
| `allow`                                                   | Merges the crew's check-command rules into the user's agy settings; run once per machine.                                              |

## How a round works

Each round executed by `executeRound` in `lib/run.mjs` proceeds through the following steps:

1. **Claim slot**: Claims an execution slot in `.team/runs/active/` ensuring no overlapping fences and a maximum of 3 concurrent runs.
2. **Staging copy**: Creates an isolated mirror of the repository in `.team/worktrees/<order-id>/`, excluding protected and lead directories (and, for the free-tier member, `research/` too), installs its own `node_modules` offline from the pnpm store, and writes the gate hook into its `.agents/`. Never link it to the repo's `node_modules` instead: pnpm writes through the link (ADR-0007 amendment).
3. **The run**: Agy runs in headless `accept-edits` mode with `--sandbox`; OpenCode runs `--standalone` with a freshly written `opencode.json` standing in for that sandbox (`lib/opencode.mjs`), with `PWD` set to the staging copy (OpenCode takes its working directory from `PWD`, not from the process's own directory: without it, a run launched from the repo root works in the real repo and ignores the staging copy's permission file), with stdin closed (`opencode run` otherwise waits for it to end), and with `GIT_DIR`/`GIT_CEILING_DIRECTORIES` pointed away from the real repository. A transport error (the CLI could not start or returned nothing readable) is retried once automatically; a failed acceptance is never retried. A run that outlives its timeout is killed with its whole process tree (OpenCode's `--standalone` starts a private server under the client).
4. **Fence sorting**: Compares the staging tree against the baseline; changes within the fence are applied to the main workspace, conflicting edits go to `rejected/conflicts/`, and out-of-fence edits go to `rejected/`. OpenCode's own `opencode.json` and `.opencode/` are removed from the staging copy first, so they are never sorted as a crew change.
5. **Protected-folder restore**: Reverts any unexpected alterations to reference roots (`original/`, `src/`), preserving unauthorized edits in `rejected/protected/`. The staging copy is then deleted before acceptance runs.
6. **Acceptance**: Runs the order's acceptance commands in the real repository. The crew has already run the read-only ones (eslint, prettier --check, tsc) itself, and an OpenCode member may also run Vitest itself (it has no sandbox stopping the writes Vitest needs); other tests stay with the bridge's acceptance run.
7. **Report**: Compiles `report.md` recording execution metrics, applied files, fence violations, acceptance logs, and the crew's structured JSON report.
8. **Ledger**: Records round metrics, timing, tokens, member and status into `.team/ledger.json` and updates `.team/LEDGER.md`.
9. **Release slot**: Releases the concurrency lock.

## Files

Bridge library modules in `tools/crew/lib/`:

- `acceptance.mjs`: Runs order acceptance test and lint commands against the repository.
- `agy.mjs`: Constructs agy's CLI arguments, runs any crew process (shared by both runners) and manages retries, tree-kill and output parsing.
- `commands.mjs`: The check commands the crew may run, as agy rules, as OpenCode wildcard patterns, and as a matcher.
- `gate.mjs`: agy's `PreToolUse` hook in a staging copy: lets check commands through, refuses the rest with a reason.
- `fence.mjs`: Validates changed paths against fence rules and restores protected directories.
- `glob.mjs`: Matches fence glob patterns (`**`, `*`, `?`, `{a,b}`) and detects overlapping fences.
- `ledger.mjs`: Manages run records and token accounting in `.team/ledger.json` and `.team/LEDGER.md`.
- `members.mjs`: The member registry (who runs an order, on which model) and its own front-matter/command-line resolution and validation.
- `opencode.mjs`: Constructs OpenCode's CLI arguments, writes its `opencode.json` permission file, and sorts a finished run into the bridge's outcomes.
- `order.mjs`: Parses work order front matter and validates IDs, kinds, models, and fence safety.
- `permissions.mjs`: Merges the crew's rules into the user's agy settings for `crew allow` and `crew ping`.
- `prompt.mjs`: Composes dispatch and follow-up prompts from `CREW.md` and order definitions.
- `run.mjs`: Orchestrates complete rounds for `dispatch` and `followup` workflows, for either runner.
- `slots.mjs`: Manages run slot claims and concurrency locks to prevent conflicting runs.
- `tree.mjs`: Handles file tree traversal, staging copies, and SHA-256 tree diffing.
- `workspace.mjs`: Readies a staging copy for crew checks: offline install and the gate hook.

Working state and output locations:

- **Orders**: `.team/orders/<id>.md` (lead specifications).
- **Runs**: `.team/runs/<id>/round-<N>/` (prompts, raw stdout/stderr — `agy-*` or `opencode-*` depending on the member — reports, acceptance outputs, and rejected files) and `.team/runs/active/` (active slot claims).
- **Ledger**: `.team/ledger.json` (machine data) and `.team/LEDGER.md` (summary report, with a Member column).

## Testing the bridge

Tests use Node's built-in test runner and fake `agy`/`opencode` scripts selected with the `CREW_AGY`/`CREW_OPENCODE` environment variables:

```sh
node --test "tools/crew/tests/*.test.mjs"
```

For the complete protocol, see [docs/team/PROTOCOL.md](../../docs/team/PROTOCOL.md). For architectural decisions, see [docs/adr/0007-crew-bridge.md](../../docs/adr/0007-crew-bridge.md).
