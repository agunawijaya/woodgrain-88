# Prompt 03a — Finish Hot & Cold, and the Den's Kid setting

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, after `b666453` (Trailblaze committed).
> Kit and Hall owner for this session. May run at the same time as `04a-trailblaze-polish.md`,
> which stays inside `games/trailblaze/`.
> Recommended: Opus 5.5, effort **xhigh**. No owner checkpoint (the looks were approved in 03).
> You lead a Gemini crew via `pnpm crew`; run `pnpm crew ping` first.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, the builder skill, `prompts/03-hot-and-cold.md` (the full brief; it
   still applies), commit `158f0b7` message, `games/hot-and-cold/docs/NOTES.md`,
   `docs/BACKLOG.md`, ADR 0011 (Kid memory) and 0012 (Kid reflexes).
2. **Siblings that are finished:** `games/tank-duel/` and `games/trailblaze/` show what "done"
   means here: manifest and lazy load in the Hall, e2e flows, screenshot runs, the four docs,
   PROGRESS row. Match that bar.
   First reply: hard rules in five lines, what 03 left open (from the commit and the code), your
   plan, ports (game 4521, Playwright 5521; Hall 4488), `crew ping` result.

## 1. What is open from prompt 03

Stages 3 to 8 of prompt 03 §10 as far as they are not already done. Verify each item against the
code before you rebuild anything; keep what works.

- **Hall integration (03 §14):** replace `hall/src/data/coming-soon/hot-and-cold.ts` with the real
  manifest and a lazy `load`; 10 original channels grouped Race / Turns / Solo + 4 Remix (Two
  Flags, Minefield, Thin Ice, Drift Storm: check that all four rules exist in the engine and are
  opened by their patches); daily, challenge links, micro-challenges, events, results
  `presentation: 'game'`, share with the emoji summary, pause items (Clues mode, Look), difficulty
  per seat, Kids as seats, Den TV demo.
- **Den Life checks:** patches (03 §3.6) including the secret Lucky 75 bonus round; the possibility
  fog disabled with a reason in Daily, challenge links and records.
- **E2E (03 §9):** every flow listed there, on port 5521; screenshot runs at 1280×720 and
  1920×1080, light and dark, for each of the three looks: menu, mid-hunt, bomb moment, capture
  moment, results.
- **Docs (03 §11):** ABOUT, HOW-TO-PLAY, ARCHITECTURE, CHANGES-FROM-ORIGINAL; NOTES updated with
  final Kid memory values and balance numbers.
- **Critique pass:** at least three rounds per look in the running game (not the harness): is
  every clue readable at a glance, is the capture moment the high point, does the bomb-and-walk-home
  read, light and dark. Fix what you find.
- **Feel:** step and reveal feedback within one frame; check the picture is not behind the rules
  (Trailblaze had a one-cell lag; make sure Hot & Cold has none).

## 2. The Den's Kid setting (kit and Den)

Prompts 03 and 04 promised it; it does not exist yet.

- In the Den's settings: **Kids — Human** (default) / **Sharp** (harder: perfect memory, no slips,
  half reaction time). One line explains it. Stored through the kit store (schema migration if
  needed, with a test).
- The kit exposes it to games (`kids` API: the current mode, and a way for `kids/memory` and
  `kids/reflex` profiles to resolve Human or Sharp). Records and share lines mark Sharp results.
- Wire it into Hot & Cold and Trailblaze (Trailblaze: a few lines where it builds its Kid riders;
  coordinate by editing only those lines, `04a` does not touch them). Tank Duel: if its Kids use
  neither module, leave it and note it in its NOTES.
- Unit tests in the kit; one e2e in each of the two games that switches the setting and sees the
  difference in the results panel ("What Lou remembered" shows nothing forgotten; "How Rosa saw
  it" shows no slips).

## 3. When you finish

Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm check`, `pnpm build`, the Hot & Cold e2e
and screenshot runs; all green (opt-in suites noted). Report: what was open and what you did,
balance numbers vs 03 targets, performance per look, kit changes, crew ledger rows, deviations.
Update PROGRESS once (Hot & Cold row playable, a Hot & Cold section like Trailblaze's). Shared
files only at the very end, re-read first, change only your lines. No commits.
