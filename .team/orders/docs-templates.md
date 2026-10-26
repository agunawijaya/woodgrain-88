---
id: docs-templates
kind: docs
fence:
  - docs/templates/ABOUT.md
  - docs/templates/HOW-TO-PLAY.md
  - docs/templates/ARCHITECTURE.md
  - docs/templates/CHANGES-FROM-ORIGINAL.md
  - docs/templates/NOTES.md
acceptance:
  - pnpm exec prettier --check docs/templates
reads:
  - CLAUDE.md
  - docs/PLAN.md
  - packages/kit/src/contract.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/events.ts
---

## Goal

Write the five per-game documentation templates that every game prompt copies into
`games/<id>/docs/`. Each template is headings with one line of guidance under each (in italics),
so a game session knows exactly what to write where.

## Context

- Audience per file: `ABOUT.md` is a brochure for players (the original, its hook, what is new);
  `HOW-TO-PLAY.md` is the player's manual; `ARCHITECTURE.md` is for programmers;
  `CHANGES-FROM-ORIGINAL.md` lists every deliberate difference; `NOTES.md` records verified facts
  from the behaviour dossier (in the session's own words) and simulation results.
- The builder conventions every game session follows: ABOUT is a brochure that makes people want to
  play (the original, its hook, what is new); HOW-TO-PLAY is the player's manual (controls table,
  rules, modes, settings, scoring, achievements, tips); ARCHITECTURE is for programmers (module map,
  state machines, AI, where every visual and sound is defined and how to change it, tests);
  CHANGES-FROM-ORIGINAL lists deliberate differences; NOTES records verified facts and simulations.
- Diagrams are Mermaid code blocks only. Include one small example diagram (a state diagram in
  ARCHITECTURE, a flowchart in HOW-TO-PLAY is not needed).
- The hard rules matter in docs too: original titles and publisher names appear only in the
  "Inspired by" line of ABOUT and in CHANGES-FROM-ORIGINAL's opening line; never copy text, data
  or art from the originals; years stay "late 1970s / early 1980s" unless cited.

## Behaviour and edge cases

1. Every file starts with `# <Game title> — <document name>` and a one-line italic purpose.
2. `HOW-TO-PLAY.md` sections: Goal · Controls (a table with columns Action, Seat 1 keys, Seat 2 keys,
   Gamepad) · Rules · Modes and channels · Settings · Scoring · Patches (Club, Pro, Legend, secret
   hint) · Tips.
3. `ARCHITECTURE.md` sections: Module map (Mermaid flowchart placeholder) · State machines (Mermaid
   stateDiagram example: menu → play → paused → results) · Engine and determinism · AI and bots ·
   Events (table: type, fields, when) · Channels · Patches · Micro-challenges · Rendering (where each
   visual is defined and how to change it) · Audio (where each sound is defined) · Tests and
   simulations · Kit candidates.
4. `ABOUT.md` sections: The hook (one paragraph) · Inspired by (one line) · What is new · Who it is
   for · Light and dark (how each looks).
5. `CHANGES-FROM-ORIGINAL.md` sections: Kept · Changed (table: Original behaviour, Woodgrain
   behaviour, Why) · Added · Removed · All-ages reframes.
6. `NOTES.md` sections: Dossier facts used (with dossier section references) · Verified quirks and
   what we did with each · Feel numbers (table) · Simulations (table: scenario, runs, result,
   target) · Open questions.
7. Plain English, short, no emojis. Each template under 90 lines.

## Tests required

None; the acceptance command checks formatting.

## Out of scope

Anything outside the fence.
