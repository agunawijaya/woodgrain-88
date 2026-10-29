# Prompt 04a — Trailblaze polish (architect review of `b666453`)

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, after `b666453`.
> Stay inside `games/trailblaze/` (plus its own docs and media). Do not touch `packages/`, `hall/`
> or the lines where Trailblaze builds its Kid riders: `03a` runs at the same time and owns the kit,
> the Hall and the Den's Kid setting.
> Recommended: Opus 5.5, effort **xhigh**. Stages in §3.
> **Owner checkpoint:** stage 1 ends with new hero frames; STOP and wait.
> You lead a Gemini crew via `pnpm crew`; run `pnpm crew ping` first.

## 0. Read first

`CLAUDE.md`, the builder skill, `prompts/04-trailblaze.md` (still the brief), ADR 0013,
`games/trailblaze/docs/NOTES.md` and `docs/media/hero/NOTES.md`. First reply: hard rules in five
lines, this prompt, ports (game 4522, Playwright 5522), `crew ping` result.

## 1. Review findings to fix

1. **The riders are too small to see from the overhead camera.** The owner asked for people on
   futuristic bikes, mummies and skaters; at 1920×1080 from above they read as dots, and only the
   Chase camera shows them. Without changing the grid or the rules:
   - draw each rider at a readable size from above (about two to three cells long, the head or
     body clearly shaped, a soft contact shadow and a ring or glow in the rider's colour);
   - give them life: lean into turns, the mummy's shuffle and trailing linen, the skater's push and
     frosty breath, the loco's wheels and steam;
   - on every point, a short camera push toward the crash (about 0.6 s, eased, back to overhead
     before the restart; off with reduced motion; the frame stays fully readable);
   - in the pre-match cards and the menu demo, show each look's rider close up so the character
     design is seen.
2. **Mummy's Wrap crash is wrong.** It shows a white lightning flash. It must be the brief's moment:
   the bandage winds the mummy into a cocoon from feet to head, it wobbles and topples. No
   lightning, no white-out. Check the other three crashes against the brief too (Neon: light
   shards; Trains: tips over, wheels spinning; Ice: frost creeps up, crack, slides to a stop) and
   make sure none of them hides the board behind a bloom.
3. **Mummy's bandage reads as grey pipe.** Tint the linen clearly in each rider's colour (dyed
   wraps), add a woven texture drawn in code and a pattern per rider, so the two trails are told
   apart at a glance in light and dark.
4. **Results screen:**
   - score perspective must agree everywhere (title "10–0" and share "0–10" currently disagree):
     always state the winner first in the title, and the share line from the sharer's side;
   - "Cells claimed 110 / 110" is unclear: show "Cells laid" per rider as two numbers;
   - share line uses the brief's symbols (🟦 you, 🟥 rival, ⬜ both) as in prompt 04 §3.7.
5. **The picture runs about one cell behind the rules** (NOTES). The rider shown must be where the
   engine is: interpolate from the last step toward the next, show a queued turn on the next step,
   input-to-screen within one frame. Measure before and after; add a test that the rendered head
   position is never more than one interpolation step behind the engine.
6. **Solo Doodle** shows start chevrons for the unused seat; hide them.

## 2. Keep

Everything that works and was approved: the four looks, the spectators (host, conductor, priest,
snowman), the overhead layout, sound palettes, Computer 1977's faithful weakness.

## 3. Stages

1. **Hero frames — OWNER CHECKPOINT.** For each look, by night: (a) mid-duel from overhead with the
   bigger riders, (b) the crash camera push at its closest. Plus a before/after pair of the Mummy
   crash. Save to `games/trailblaze/docs/media/hero/` (replace the old frames, keep notes);
   **STOP and wait for the owner.**
2. Implement 1–6 fully, light and dark, all four looks.
3. Re-run the screenshot set (96 pictures) and e2e; update NOTES, HOW-TO-PLAY if anything shown
   changed, PROGRESS row (only your lines, at the very end).

Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm check`, `pnpm build`, Trailblaze e2e; all
green. Report what changed per finding, latency measured, fps per look with a full board. No
commits.
