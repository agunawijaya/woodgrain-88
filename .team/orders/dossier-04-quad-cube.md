---
id: dossier-04-quad-cube
kind: dossier
fence:
  - research/dossiers/04-quad-cube.md
acceptance:
  - node tools/crew/checks/dossier.mjs research/dossiers/04-quad-cube.md
reads:
  - src/04_3D_Tic_Tac_Toe.asm
  - src/vcs.h
---

## Goal

Write the behaviour dossier for cartridge slot 4 (`src/04_3D_Tic_Tac_Toe.asm`), which Woodgrain '88 will
rebuild as **Quad Cube** (brain). It tells the architect and a later game prompt exactly how the
original program behaves, so our fresh game keeps its soul. It is private research: git-ignored and
never published.

## Context

- The disassembly is machine-generated from a 2 KB program for a late-1970s home console: a 6507
  processor, a video and sound chip (TIA), and a RIOT chip for the 128 bytes of RAM, a timer and the
  switches. `src/vcs.h` names the registers. Labels are generated (`START`, `SUB_F5E7`, `L_F0FC`);
  every line ends with its address and cycle count; data tables appear as bytes with bit pictures.
  The disassembler can mistake data for code and the other way round: say so where it matters.
- This is the PAL release: 50 frames per second. A frame is vertical sync, vertical blank (game
  logic), the visible picture drawn line by line, then overscan (more logic).
- The file header and the project's manifest call this "3D Tic-Tac-Toe" and guess it is 3-D Tic-Tac-Toe by
  Atari. Those labels are unverified. Trust the code.
- Landmarks: console switches are read from `SWCHB` (bit 0 RESET, bit 1 SELECT, bit 3 colour or
  black-and-white, bits 6 and 7 the left and right difficulty switches); joysticks from `SWCHA`;
  fire buttons from `INPT4` and `INPT5`; paddles from `INPT0`–`INPT3`; collisions from the `CX…`
  registers; sound from `AUDC0/1`, `AUDF0/1`, `AUDV0/1`; the frame timer from `TIM64T` and `INTIM`.

## What to write

Create `research/dossiers/04-quad-cube.md` with this front matter (fill in `identity`):

    ---
    dossier: 04-quad-cube
    game: Quad Cube
    cartridgeSlots: [4]
    sources: [src/04_3D_Tic_Tac_Toe.asm]
    manifestLabel: 3D Tic-Tac-Toe
    identity: matches | mismatch | uncertain
    verified-by-lead: no
    ---

Then a title line `# Dossier 04 — Quad Cube (cartridge slot 4)` and these sections,
in this order, with exactly these headings:

## 1. Identity check

What the code actually is and whether it matches the manifest's guess, with the evidence.

## 2. Game loop

States (attract, playing, between rounds, game over), the frame structure, timers, how a round or
game starts and ends.

## 3. Controls

Joystick, fire button and paddle use; each console switch (SELECT, RESET, colour/B&W, left and
right difficulty) and what it does in this game.

## 4. Rules and scoring

Every rule you find, each with the label or line range where it lives.

## 5. Variations

How many game variations SELECT steps through and what changes between them, as a table.

## 6. Opponents and AI

How the computer plays, if it does, and how hard it is.

## 7. Hooks

Bugs, quirks, Easter eggs, hidden behaviour, anything surprising, each with evidence. These are
what make a reborn game special, so look hard.

## 8. Feel numbers

Speeds, timings and sizes as ratios and human-scale times.

## 9. Confidence

High, medium or low for each section, and a list of what could not be determined.

## Behaviour and edge cases

1. Every claim cites where it lives: a label, an address or a line range, for example
   "(SUB_F4A3, lines 610–655)". A claim you cannot cite goes under Confidence as a guess.
2. Your own words only. Never quote instructions, bytes, tables or bit pictures, and use no code
   blocks. Describe what the code does ("the ball's horizontal speed doubles after the eighth
   hit"), not how it is written.
3. Feel numbers as ratios and human-scale times, never raw table values: "the player crosses the
   screen in about 2.5 seconds", "the shot moves about three times as fast as the player", "a round
   lasts about 2 minutes 16 seconds".
4. Read the whole file before writing. Follow the main loop from `START` and name the subroutines
   you rely on.
5. Plain English, short paragraphs, tables where they help, 1,200–3,000 words.
6. Leave `verified-by-lead: no`; the lead changes it after checking your claims.
7. This order needs no shell commands: read the files and write one Markdown file.

## Out of scope

Designing the new game, naming anything, and writing anywhere outside the fence.
