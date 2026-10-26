---
id: dossier-11-lane-hopper
kind: dossier
fence:
  - research/dossiers/11-lane-hopper.md
acceptance:
  - node tools/crew/checks/dossier.mjs research/dossiers/11-lane-hopper.md --pair
reads:
  - src/19_Freeway_Chicken.asm
  - src/11_Freeway_Rabbit.asm
  - src/vcs.h
---

## Goal

Write the behaviour dossier for cartridge slot 11 and 19 (`src/19_Freeway_Chicken.asm` and `src/11_Freeway_Rabbit.asm`), which Woodgrain '88 will
rebuild as **Lane Hopper** (arcade). It tells the architect and a later game prompt exactly how the
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
- The file header and the project's manifest call this "Freeway Rabbit / Freeway Chicken" and guess it is Freeway by
  Activision. Those labels are unverified. Trust the code.
- Landmarks: console switches are read from `SWCHB` (bit 0 RESET, bit 1 SELECT, bit 3 colour or
  black-and-white, bits 6 and 7 the left and right difficulty switches); joysticks from `SWCHA`;
  fire buttons from `INPT4` and `INPT5`; paddles from `INPT0`–`INPT3`; collisions from the `CX…`
  registers; sound from `AUDC0/1`, `AUDF0/1`, `AUDV0/1`; the frame timer from `TIM64T` and `INTIM`.
- **Two programs, one dossier.** `src/19_Freeway_Chicken.asm` and `src/11_Freeway_Rabbit.asm` differ in only 59 of 2,048 bytes, at these
  addresses: $F1F4, $F1F9, $F6F0–$F6F3, $F6F5–$F6FF, $F760–$F767, $F780–$F786, $F7A1–$F7A7, $F7C1–$F7CA, $F7CC–$F7D5. The slot 19 program is believed to be the original release and slot 11 a modified copy with a different hero. Woodgrain merges them into one game and brings the slot 11 variant back as a hidden skin, so the difference matters. Describe the game once in sections 1–9, using
  `src/19_Freeway_Chicken.asm` as the base, and note in passing wherever the other program behaves differently.

## What to write

Create `research/dossiers/11-lane-hopper.md` with this front matter (fill in `identity`):

    ---
    dossier: 11-lane-hopper
    game: Lane Hopper
    cartridgeSlots: [11, 19]
    sources: [src/19_Freeway_Chicken.asm, src/11_Freeway_Rabbit.asm]
    manifestLabel: Freeway Rabbit / Freeway Chicken
    identity: matches | mismatch | uncertain
    verified-by-lead: no
    ---

Then a title line `# Dossier 11 — Lane Hopper (cartridge slot 11 and 19)` and these sections,
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

## 10. Differences between the two programs

Every differing address run, what it changes, and whether the second program plays differently.

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
8. Section 10 goes through every differing address run listed above: what the bytes there are used
   for in each program (graphics, a colour, a speed, a rule, a timer) and what the player would
   notice. Compare the two files at those addresses. Finish with one sentence saying whether the
   second program is a cosmetic reskin or plays differently.

## Out of scope

Designing the new game, naming anything, and writing anywhere outside the fence.
