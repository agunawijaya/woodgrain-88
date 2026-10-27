# Crew Bridge

The crew bridge allows a Claude Code lead to hand routine development tasks to Gemini models running in the Antigravity CLI (`agy`), without requiring the owner to manually relay prompts or responses. The lead specifies work orders with strict write fences and testable criteria, and the bridge manages execution, staging isolation, fence verification, acceptance testing, and ledger tracking.

## Commands

Run commands as `pnpm crew <command>` or `node tools/crew/crew.mjs <command>`:

| Command                                 | Description                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `dispatch <order.md> [--model <model>]` | Dispatches a new work order, creating a staging copy and executing the first round.             |
| `followup <order-id> "<notes>"`         | Resumes an existing order conversation with corrective guidance (up to 3 follow-ups).           |
| `review <order-id> [options]`           | Records final verdict (`accepted`, `rejected`, `taken-over`) and token estimates in the ledger. |
| `status`                                | Reports current status, round counts, models, and token metrics across all orders.              |
| `ping`                                  | Verifies CLI connectivity, available Gemini models, and runs a zero-write plan turn.            |
| `allow`                                 | Merges the crew's check-command rules into the user's agy settings; run once per machine.       |

## How a round works

Each round executed by `executeRound` in `lib/run.mjs` proceeds through the following steps:

1. **Claim slot**: Claims an execution slot in `.team/runs/active/` ensuring no overlapping fences and a maximum of 3 concurrent runs.
2. **Staging copy**: Creates an isolated mirror of the repository in `.team/worktrees/<order-id>/`, excluding protected and lead directories, installs its own `node_modules` offline from the pnpm store, and writes the gate hook into its `.agents/`. Never link it to the repo's `node_modules` instead: pnpm writes through the link (ADR-0007 amendment).
3. **agy run**: Spawns the Antigravity CLI in headless `accept-edits` mode with `--sandbox` within the staging directory using the configured Gemini model. A transport error (agy could not start or returned no JSON) is retried once automatically, while a failed acceptance is never retried.
4. **Fence sorting**: Compares the staging tree against the baseline; changes within the fence are applied to the main workspace, conflicting edits go to `rejected/conflicts/`, and out-of-fence edits go to `rejected/`.
5. **Protected-folder restore**: Reverts any unexpected alterations to reference roots (`original/`, `src/`), preserving unauthorized edits in `rejected/protected/`. The staging copy is then deleted before acceptance runs.
6. **Acceptance**: Runs the order's acceptance commands in the real repository. The crew has already run the read-only ones (eslint, prettier --check, tsc) itself; tests only the bridge can run, because agy's sandbox refuses the writes Vitest needs.
7. **Report**: Compiles `report.md` recording execution metrics, applied files, fence violations, acceptance logs, and the crew's structured JSON report.
8. **Ledger**: Records round metrics, timing, tokens, and status into `.team/ledger.json` and updates `.team/LEDGER.md`.
9. **Release slot**: Releases the concurrency lock.

## Files

Bridge library modules in `tools/crew/lib/`:

- `acceptance.mjs`: Runs order acceptance test and lint commands against the repository.
- `agy.mjs`: Constructs CLI arguments, executes the Antigravity process, and manages retries and output parsing.
- `commands.mjs`: The check commands the crew may run, as agy rules and as a matcher.
- `gate.mjs`: agy's `PreToolUse` hook in a staging copy: lets check commands through, refuses the rest with a reason.
- `fence.mjs`: Validates changed paths against fence rules and restores protected directories.
- `glob.mjs`: Matches fence glob patterns (`**`, `*`, `?`, `{a,b}`) and detects overlapping fences.
- `ledger.mjs`: Manages run records and token accounting in `.team/ledger.json` and `.team/LEDGER.md`.
- `order.mjs`: Parses work order front matter and validates IDs, kinds, models, and fence safety.
- `permissions.mjs`: Merges the crew's rules into the user's agy settings for `crew allow` and `crew ping`.
- `prompt.mjs`: Composes dispatch and follow-up prompts from `CREW.md` and order definitions.
- `run.mjs`: Orchestrates complete rounds for `dispatch` and `followup` workflows.
- `slots.mjs`: Manages run slot claims and concurrency locks to prevent conflicting runs.
- `tree.mjs`: Handles file tree traversal, staging copies, and SHA-256 tree diffing.
- `workspace.mjs`: Readies a staging copy for crew checks: offline install and the gate hook.

Working state and output locations:

- **Orders**: `.team/orders/<id>.md` (lead specifications).
- **Runs**: `.team/runs/<id>/round-<N>/` (prompts, raw stdout/stderr, reports, acceptance outputs, and rejected files) and `.team/runs/active/` (active slot claims).
- **Ledger**: `.team/ledger.json` (machine data) and `.team/LEDGER.md` (summary report).

## Testing the bridge

Tests use Node's built-in test runner and a fake `agy` script selected with the `CREW_AGY` environment variable:

```sh
node --test "tools/crew/tests/*.test.mjs"
```

For the complete protocol, see [docs/team/PROTOCOL.md](../../docs/team/PROTOCOL.md). For architectural decisions, see [docs/adr/0007-crew-bridge.md](../../docs/adr/0007-crew-bridge.md).
