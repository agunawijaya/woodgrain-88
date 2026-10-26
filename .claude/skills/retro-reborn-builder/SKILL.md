---
name: retro-reborn-builder
description: Build conventions for Claude Code sessions that implement games in a "retro reborn" web game collection (a repo with packages/kit, a Hall catalog, games/<id> folders and prompts/NN-*.md written by an architect). Use this skill at the start of every session in such a repo and whenever you build, polish, rename, consolidate or test a game, the Hall, the kit or a shared package there — especially when running a prompt from the prompts/ folder.
---

# Retro Reborn — builder conventions

You are building one part of a public collection of modern web games reborn from retro originals. An architect
writes a prompt for each task; the owner approves designs and reviews results. Your job is to execute the prompt you
were given completely, to a high visual and engineering standard, without stepping on other sessions.

## Before you touch anything

1. Read `CLAUDE.md` (hard rules), `AGENTS.md`, `docs/ARCHITECTURE.md`, the ADRs, the kit's public API and the whole
   prompt. The prompt's integration/override section wins over earlier sections; `CLAUDE.md` hard rules win over the
   prompt — report any conflict.
2. In your first message, summarise the hard rules in five lines and say which prompt you are running, who owns kit
   changes this wave, and your dev-server port. This proves the conventions were read.
3. Check the repo state for your area (does the game folder exist? is it already shipped?). If the prompt looks
   already done or partially done, stop and tell the owner instead of redoing work.

## How to work

- **Engine first.** Pure TypeScript with no DOM or rendering: state, rules, AI, scoring, daily generation — seeded
  and deterministic with the kit RNG (use iteration/node budgets, not wall clock, in tests).
- **Simulate before you draw.** Bots and seeded simulations verify balance targets in the prompt; record results in
  `games/<id>/docs/NOTES.md` and lock them as regression tests with tolerances.
- **Verify the original.** Read the reference source (outside the repo, read-only). Record verified behaviour,
  quirks and bugs in NOTES.md in your own words. Never copy its text, data, layouts or art into the repo (for open
  licences follow the attribution rules in `CLAUDE.md`). Scratch work on originals happens outside the repo.
- **Hero-frame checkpoint.** If the prompt has one, build the hero frames first, critique at least five rounds, save
  them, then stop and wait for the owner's approval. Do not continue without it.
- **Then wireframes, then art, then modes, then sound and feel,** as the prompt's staged workflow says.
- **Critique loop.** Screenshot every listed screen at 1280×720 and 1920×1080 in light and dark. Critique as a
  demanding art director and game designer: Is it beautiful and alive? Is the signature moment thrilling? Is anything
  too small to read, overlapping, or leaving dead space? Would this be the README hero image? Fix and re-shoot, at
  least three rounds.

## Standards every game meets

- Light and dark appearance, both designed; react to the kit's appearance changes live; reduced motion honoured.
- Web first: desktop, keyboard + mouse; full keyboard play; visible focus for keyboard users only (`:focus-visible`);
  AA contrast. Drag and drop wherever objects move, with click and keyboard alternatives.
- **Navigation standard:** "← Back to the Hall" on the game menu (title screen), Escape there returns to the Hall;
  visible pause button with an "Esc" hint during play; pause menu order Resume · game items · How to play · Settings
  · Game menu · Back to the Hall; results order Play again (R) · Game menu · Back to the Hall (H); confirm before
  losing progress; browser Back works.
- Integrate through the kit contract: manifest (with emblem, originalTitle/uiTitle), `demo(seed)` for the Hall's
  attract mode (silent, pauses off-screen, draws in the given appearance), results via `reportResult` (with the
  "game presents its own results" option when you have your own screen), `share`, pause-menu items, daily numbering
  from the kit.
- The project's visual asset policy (often zero raster: SVG/Canvas/WebGL, procedural everything), self-hosted OFL
  fonts, no runtime network requests. 60 fps at 1920×1080 on a mid-range laptop; lazy-load heavy libraries.
- No gambling mechanics; all-ages content; our own words for every line of copy.
- Humanized code: intention-revealing names, small focused functions, comments that explain *why*, no filler or
  AI-sounding comments, no commented-out code; TypeScript strict; ESLint + Prettier clean.

## Documentation per game (Mermaid diagrams only)

`ABOUT.md` (a brochure that makes people want to play: the original, its hook, what is new), `HOW-TO-PLAY.md` (the
player's manual: controls table, rules, modes, settings, scoring, achievements, tips), `ARCHITECTURE.md` (for
programmers: module map, state machines, AI, where every visual and sound is defined and how to change it, tests),
`CHANGES-FROM-ORIGINAL.md`, and `NOTES.md` (verified facts, simulations). Follow `docs/templates/`.

## Working alongside other sessions

- Stay inside the folders your prompt names. Touch shared files (Hall catalog, README via the docs script, PROGRESS
  row) only at the very end, re-reading each file first and editing only your own line.
- Only the named kit owner of the wave changes `packages/kit`; everyone else writes helpers in `games/<id>/src/lib/`
  and lists them as kit candidates.
- Use your assigned port and a game-scoped Playwright config; do not run repo-wide e2e or screenshot jobs while
  others run; never stop processes you did not start; scope formatters to your own files.
- If you need to install a dependency while others run, ask the owner first.
- Treat failures that originate in another game's folder as not yours: report them, don't fix them.
- **Never commit or push.** Update `docs/PROGRESS.md` once, at the end.

## When you finish

Reply with: what you built; verified facts about the original and any verdicts the prompt asked for; simulation and
performance numbers; deviations from the prompt and why; known gaps; kit changes or kit candidates; exact commands to
run and test it locally.
