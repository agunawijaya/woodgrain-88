---
id: hc-architecture
kind: docs
model: gemini-3.8-flash-high
fence:
  - games/hot-and-cold/docs/ARCHITECTURE.md
acceptance:
  - pnpm exec prettier --check games/hot-and-cold/docs/ARCHITECTURE.md
reads:
  - docs/templates/ARCHITECTURE.md
  - games/trailblaze/docs/ARCHITECTURE.md
  - games/hot-and-cold/docs/NOTES.md
  - games/hot-and-cold/src
  - games/hot-and-cold/tests
  - docs/adr/0011-kid-memory.md
  - docs/adr/0014-hot-and-cold-looks.md
---

## Goal

`games/hot-and-cold/docs/ARCHITECTURE.md`: the programmers' guide to Hot & Cold. Follow the
template's headings (`docs/templates/ARCHITECTURE.md`) and the shape, depth and tone of
`games/trailblaze/docs/ARCHITECTURE.md`, which is the model. Write only what the code shows: every
module, file and function you name must exist. Read the folders before you write.

## Content

- **Module map**: a Mermaid flowchart of the folders and how they depend, and a table with one
  line per folder in `src/` saying what lives there.
- **State machines** (Mermaid `stateDiagram-v2`):
  - a match: fields, checks, bombs, the capture celebration, the clock, the end;
  - the screens: menu, pre-match, play, paused, results, the tutorial.
- **Engine and determinism**: ticks of 2/50.77 s, the seeded field generator, the solver, where
  the rules for each variation live, how a check is resolved (the flag first).
- **AI and bots**: the Kid (`ai/`): facts, memory (`kids/memory`), the solver's stories, the value
  of a square; where each Kid's style is set.
- **Events**: what the session emits, and the Den Life events (`progress/events.ts`).
- **Channels, patches, micro-challenges**: where they are defined, and how a Remix channel's rule
  reaches the engine (Two Flags, Minefield, Thin Ice, Drift Storm).
- **Rendering**: the `FieldView` contract (ADR-0014), and a table of where each visual lives per
  look: field, clue pieces, explorers, the bomb, the capture, the HUD.
- **Audio**: where the palettes and the event mapping live.
- **Tests and simulations**: what each test folder covers, how to run them, the opt-in suites.
- **Kit candidates**: modules that other games could share, if any. Say "none yet" otherwise.

## Rules

- Markdown only, diagrams in Mermaid. Our own words; no original game titles or brand names.
- No claims you did not check in the code. If something is unclear, leave it out and list it in
  your report.
