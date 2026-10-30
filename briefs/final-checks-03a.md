# Brief: final repo checks for prompt 03a

For: qa-scout. Run, read the output, report. Edit nothing, start no dev server, change no git
state. Another session's work in `games/trailblaze/` is part of the tree: report failures there
too, but do not fix anything anywhere.

Run from `E:\Projects\Atari-2600\32-in-one`, one after another, and for each give the exact command,
pass or fail, and the key lines (totals, every failing test or file with its first error line):

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm lint`
4. `pnpm check`
5. `pnpm build`, plus the sizes it prints for the Hall's entry chunk and the Hot & Cold and
   Trailblaze chunks (raw and gzip).
6. The opt-in Hot & Cold balance suite:
   `HC_BALANCE=1 pnpm exec vitest run --project hot-and-cold games/hot-and-cold/tests/balance.test.ts`.
   Give each test's name and result, and any measured numbers it prints.

A command that did not run is "not run", never "passed". Keep long output in
`briefs/final-checks-03a.report.md` and reply with a short summary and that path.
