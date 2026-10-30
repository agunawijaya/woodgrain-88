# Brief: check Gravity Duel's documented numbers against the code

For: **qa-scout** (Haiku subagent). From: the lead (prompt 05).

## Task

Read these documents:

- `games/gravity-duel/docs/NOTES.md`;
- `HOW-TO-PLAY.md`;
- `ABOUT.md`;
- `CHANGES-FROM-ORIGINAL.md`;
- `ARCHITECTURE.md`.

For every number or named fact they state about the game, find where the code defines it and
check that they agree:

- timings (ticks, seconds);
- sizes and radii;
- speeds;
- fuel and ammo counts;
- gravity strength and cap;
- Remix values;
- Kid style values in the NOTES table;
- channel names and numbers;
- patch and micro-challenge titles and goals;
- control keys;
- file paths.

Where to look:

- the engine: `src/engine/types.ts`, `physics.ts`, `match.ts`, `remix.ts`, `variations.ts`;
- channels, progress and manifest: `src/channels.ts`, `src/progress/*.ts`, `src/manifest.ts`;
- the Kids and controls: `src/ai/styles.ts`, `src/session/controls.ts`.

## Rules

- **Do not edit any file.** Report only.
- For each disagreement give:
  - the document, its line, and what it says;
  - the code's file, its line, and the actual value.
- Also list paths named in the docs that do not exist.
- Keep the report short: a table of disagreements, then a one-line count of facts checked. If
  everything agrees, say so.
