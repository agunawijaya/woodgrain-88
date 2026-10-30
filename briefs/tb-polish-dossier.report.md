# Trailblaze polish dossier (read-only)

## 1. Riders, per look

### Neon Grid — Bikes (file: `looks/neon/bike.ts`)

**Model & size:**

- `createBike(options: BikeOptions)`: built to 1 cell, drawn 30% larger (`BIKE_SCALE = 1.3`, line 35)
- Two different shapes per seat: `SHAPES[seat % 2]` (lines 50–65)
  - Seat 0 (Lancer): 1.18 units long, 0.78 units wide; pointed nose, swept fin (line 51–57)
  - Seat 1 (Comet): 0.96 units long, 0.92 units wide; bubble canopy, twin fins (line 58–64)

**Parts:**

- Hull with profile (lines 41–47): radius steps from nose to tail
- Glowing wheel ring: radius 0.29, axle height 0.31 (lines 32–33)
- Glass canopy with stripe in seat colour
- Helmet under glass

**Placement & turning:**

- Called by session's `step()`, trail-rig calls `figure.ride(position, yaw, dt, speedStage)` (trail-rig.ts:203)
- `position` is result of `crossingPoint()` along current crossing's curve (crossing.ts:40–52)
- Yaw computed from `crossingTangent()`: `Math.atan2(-tangent.z, tangent.x)` (trail-rig.ts:200)
- Bike leans into turns: `LEAN_PER_TURN_RATE = 0.06` per radian/second turning (line 37, bike.ts:121–123)

**Animation:**

- Speed-up stretches light streaks (visual effect in walls, not rider)

### Toy Trains — Locomotives (file: `looks/trains/loco.ts`)

**Model & size:**

- `createLoco(options: LocoOptions)`: built to 1 cell, drawn 30% larger (`LOCO_SCALE = 1.3`, line 38)
- Seat 0 (Ember): tender engine, orange boiler with tall funnel, cowcatcher, red wheels
- Seat 1 (Bluebell): tank engine, blue side tanks, short chimney, square cab, buffers
- Ride height: `MAT_TOP + BED_HEIGHT + 0.06` (line 33, atop track bed)

**Parts:**

- Boiler and cab, wheels (instanced parts: `parts.wheels` is a Mesh array, line 105–112)
- Funnel/chimney with puff point
- Key on side or roof, rotating when moving
- Lamp group for headlamp cone at night (line 50)

**Placement & turning:**

- Same call signature as bikes: `figure.ride(position, yaw, dt, speedStage)` (loco.ts:117)
- Key rotates based on distance travelled: `wheelTurn += distance / 0.1`, applied to wheels (loco.ts:109–112)
- Puff of steam every 0.5 cells (`PUFF_EVERY = 0.5`, line 35) from funnel top

**Animation:**

- Chuff animation: wheels spin (lines 109–112)
- Derail crash: tips onto side, wheels spin in air (lines 104–104, state tracked in `derail` variable)

### Mummy's Wrap — Mummies (file: `looks/mummy/mummy.ts`)

**Model & size:**

- `createMummy(options)`: built to 1 cell, drawn 50% larger (`MUMMY_SCALE = 1.5`, line 39)
- Seat 0 (Wick): tall thin mummy, height 0.6, radius 0.15, head radius 0.16, orange sash (lines 48–50)
- Seat 1 (Bun): short stout mummy, height 0.44, radius 0.2, head radius 0.18, blue sash

**Parts:**

- Body wound in linen strips with wrapping texture (`wrappedTexture()`, lines 326–360)
- Head with eyes peeping through wrapped gap (lines 156–192)
- Arms held stiffly out front (lines 195–222)
- Loose end flapping from head (lines 225–232)
- Bandage trailing from back down to floor as it rides (lines 233–235)
- Cocoon (hidden, wound round mummy on crash): capsule scaled up, wrapped texture (lines 237–251)

**Placement & turning:**

- Same: `figure.ride(position, yaw, dt, speedStage)` (mummy.ts:258)
- Shuffle group animates: `shuffle.rotation.x = Math.sin(phase) * swing` + leg rotation (lines 262–268)
- At top speed, shuffle becomes frantic waddle: `8 + speedStage * 4` phase speed (line 262)

**Animation:**

- Stiff-legged shuffle with arms swinging (lines 262–272)
- Loose end flutters (line 272)
- Crash: winds into cocoon in 0.35 s (`WIND_SECONDS`, line 36), topples in 0.4 s (`TOPPLE_SECONDS`, line 37)
  - Cocoon visible on crash (line 276), scales up: `cocoon.scale.set(1, winding, 1)` (line 290)
  - Mummy body hidden when winding ≥ 0.8 (line 292)
  - Figure rotates and rises as it topples (lines 297–298)

### Ice Trail — Skaters (file: `looks/ice/skater.ts`)

**Model & size:**

- `createSkater(options)`: built to 1 cell, drawn 45% larger (`SKATER_SCALE = 1.45`, line 32)
- Seat 0 (Juniper): orange suit, bobble hat
- Seat 1 (Sorrel): blue suit, hood and earmuffs
- Ride height: `ICE_TOP + 0.06` (lines 79, 95+)

**Parts:**

- Body: suit capsule (line 95), collar torus (line 96), head sphere (line 98), eyes (line 99–100)
- Legs: two leg groups with thighs, boots, skates, swept back from ankles (lines 77–94)
- Arms: one arm swept back (frost trails from hand, line 36 in skater interface shows `handPosition()`)
- Mouth for frosty breath (`breathPosition()` method, line 38)

**Placement & turning:**

- Same: `figure.ride(position, yaw, dt, speedStage)` (skater.ts extends RiderFigure)
- Lean group handles rotation: skater leans into turn (line 68, `const lean = new Group()`)
- Crash: goes over backwards, lands flat on ice (lines 29–30)
  - `FALL_SECONDS = 0.35`, slides `SLIDE_DISTANCE = 0.5` (lines 29–30)

**Animation:**

- Arms sweep: `arm.rotation.y` changes per frame (not shown in excerpt; animation updates dt)
- Frost trails stream from hand during ride
- Frosty breath at mouth
- Crash: falls backward over 0.35 s, slides on ice with inertia dampening

---

## 2. Trails

### Trail building & layout (file: `look/trail-rig.ts` + `look/swept-trail.ts`)

**Where laid:**

- `parts.pieces.addCell(seat, crossing, clock)` for each cell being laid (trail-rig.ts:120)
- Called after a rider's move completes and it leaves the cell (trail-rig.ts:161)
- Each crossing carries entry and exit headings, so turn is known (crossing.ts:18–22)

**Material per look:**

| Look       | Trail file               | Material                  | Notes                                                                                |
| ---------- | ------------------------ | ------------------------- | ------------------------------------------------------------------------------------ |
| **Neon**   | `looks/neon/walls.ts`    | Swept light ribbons       | MeshStandardMaterial, glowing, wall height ~0.5                                      |
| **Trains** | `looks/trains/track.ts`  | Bed + sleepers + rails    | 3 layers: raised bed, sleepers (cross ties), rails on top                            |
| **Mummy**  | `looks/mummy/bandage.ts` | Linen strip, curled edges | Swept strip with cloth texture, edges curl up ~0.16 units (EDGE_CURL, bandage.ts:28) |
| **Ice**    | `looks/ice/ice-wall.ts`  | Ridge + core              | Two-layer swept, ridge on top of ice core                                            |

**Mummy bandage detail** (file: `looks/mummy/bandage.ts:1–64`):

- `createBandages()` builds one `SweptTrail` per seat (lines 36–63)
- Strip profile: 11 points across width (STRIP_WIDTH = 0.66), flat middle, curled edges (lines 31–34)
  - `across` goes from -1 to 1, curl uses `across ** 4` falloff (line 33)
  - Height rises at edges: `0.015 + EDGE_CURL * across ** 4` (line 33)
- Material: cloth texture `clothTexture(colours.main)` (lines 71–105)
  - Canvas texture: 128×128, cream base with weave lines and creases, dyed edges (lines 72–105)
  - Edges (top 18px and bottom 18px) filled with dye colour, white highlights added (lines 93–97)
- Swept along each crossed cell: `sweepSection(path, STRIP, { closed: false, uPerUnit: 2 })` (line 46)

**Swept trail construction** (file: `look/swept-trail.ts`):

- `createSweptTrail()` returns mesh with `addCell()`, `removeCell()`, `setTail()` methods
- Right-angle turns get own instanced piece (crossing.ts:67–75, `turnKind()`)
- Straight cells and other turns are approximated (comment, line 36 in ADR-0013)
- Trail pieces are instanced: full board (684 cells) costs nothing measurable over empty arena (NOTES.md:114–115)

---

## 3. Crashes, per look

### Neon Grid crash (file: `looks/neon/view.ts:99–200`)

**Function:** `createNeonView()` returns `LookParts` with crash handler:

```
crash(crash, at) {
  // at: Vector3 where crash happens
  // crash.seat: Seat that crashed
  // direction: heading vector
}
```

**Effects in `burst()` function (lines 99–107):**

1. **Shards** (64 per crash, max 4 capacity, SHARD_CAPACITY = 256, lines 35–36)
   - Tetrahedron geometry tumbling with gravity (GRAVITY = 9, line 37)
   - Colour: white shards tinted with seat colour (line 100, `colour.multiplyScalar()`)
   - Emitted from crash point (lines 101–107)
2. **Glow particles** (createParticleField, line 77)
   - Seat-coloured glow bursts (line 100)
3. **Flicker** effect on the rider's walls (lines 49–52, `Flicker` interface; lines 175–180 where flickering is applied)
   - Wall brightness pulses (not shown in excerpt, implemented in update loop)
4. **Shockwave** (lines 54–58, RingGeometry expanding from crash point)
   - Ring geometry expanding outward (line 92)
5. **Flash** and bloom:
   - Called during finish of ride: `playCrash()` in trail-rig.ts calls `parts.crash(crash, position, direction)` (line 216)
   - Specific light flash in arena (arena-package handles this through stage.lights)

**Duration:** Crash plays over the overshoot distance (CRASH_OVERSHOOT = 0.3 cells, trail-rig.ts:81); rider slides past impact ~30% into next cell

---

### Toy Trains crash (file: `looks/trains/view.ts`)

**Function:** `createTrainsView()` crash handler:

**Effects:**

1. **Clonk star** particle burst (visual, sound-driven)
2. **Headlamps** flash or dim
3. **Wheels spin wildly** as loco tips (loco.ts:104, `derail` state tracked; loco.ts:109–112 shows wheel rotation)
4. **Loco tips onto side** with tilt animation
   - Tip time: `TIP_SECONDS = 0.55` (loco.ts:36)
   - Body tilts in `tilt` group on the derailed locomotive

**Duration:** 0.55 s tip + settlement

---

### Mummy's Wrap crash (file: `looks/mummy/view.ts:168–194`)

**Function:** `parts.crash(crash, at)` — **THE MUMMY WHITE FLASH**

```typescript
crash(crash, at) {
  priest.react(crash, at);  // Priest watcher reacts
  puffSand(at, options.reducedEffects ? 4 : 16, 0.35);  // 16 sand puffs
  if (!options.reducedEffects) {
    for (let index = 0; index < 12; index++) {
      sparks.emit({...});  // 12 golden sparks (linen scraps)
    }
  }
  // WHITE FLASH CODE:
  options.stage.lights.flash(
    at.clone().setY(1),     // Flash at crash point, raised to y=1
    '#ffd9a0',              // Warm cream/golden colour (NOT pure white)
    night ? 16 : 5,         // Intensity: 16 by night, 5 by day
    0.4                     // Duration: 0.4 seconds
  );
}
```

**Dissected:**

- Line 193: `options.stage.lights.flash()` is the flash effect
- Colour: `'#ffd9a0'` is a warm cream/tan, not white (the cream of linen)
- Position: raised to y=1 above the crash point
- Intensity night/day: 16× brightness at night (more visible against dark tomb), 5× by day
- Duration: 0.4 s fade
- Mummy model: cocoon wraps round it (mummy.ts:274–276, 289–291)
  - Cocoon visible, scales from `scale.y = 0.01` to full height during WIND_SECONDS (0.35 s)
  - Figure rotates and topples after winding

**Full sequence:**

1. Mummy crashes → cocoon appears at scale (0.01, 0.01, 0.01) (mummy.ts:276–277)
2. Winding animates: cocoon.scale.y grows to 1 over 0.35 s (lines 289–290)
3. Cocoon spins: `cocoon.rotation.y = winding * 8` (line 291)
4. Mummy body hidden at winding ≥ 0.8 (line 292)
5. Figure topples: rotates z-axis by wound.side over 0.4 s, rises (lines 293–298)
6. Linen scraps (sparks) and sand dust particles emit (lines 172–191)
7. Flash fires at the instant of crash (line 193)

---

### Ice Trail crash (file: `looks/ice/view.ts`)

**Function:** `parts.crash(crash, at)` — **SKATER FALL & SLIDE**

**Effects:**

1. **Frost crystals** burst (particle field)
2. **Skater goes over backwards** (skater.ts:29–30, FALL_SECONDS = 0.35)
3. **Slides on ice** with inertia: SLIDE_DISTANCE = 0.5 units
4. **Breath freezes** (visual effect from breath position)
5. **Flash**: light flash on ice at impact
6. **Reduced motion:** if `reducedEffects`, fewer particles

**Duration:** Fall 0.35 s + slide dampening ~0.5 s total

---

## 4. Camera

### Overhead camera (default, file: `look/look.ts` + `arena-package`)

- **Setup:** Fixed orthographic table camera in `Stage` (arena-package)
- **Updated by:** `createMatchSession()` places riders via `view.placeRider(seat, cell, heading)` each round start (match-session.ts:109–110)
- **Framing:** Defined per look in `LookDefinition.framing: TableFraming` (look.ts:76)
  - Neon Grid, Trains, Mummy, Ice all have full-board framing

### Chase camera (file: `look/chase-camera.ts`)

**Setup** (lines 30–41):

```typescript
createChaseCamera(stage, currentView, framing, seat);
```

- Zooms 2× closer (`ZOOM = 2`, line 22)
- Leads ahead 0.6 seconds of travel (`LEAD_SECONDS = 0.6`, line 24)
- Follows at 4 units/s catch-up (`FOLLOW_RATE = 4`, line 26)
- Snaps to follow if jump > 8 cells (wraparound edge, `SNAP_DISTANCE = 8`, line 28)

**Called by:** `MatchSession` when player chooses Chase view (not currently exposed in UI, but wired for future use)

**Update & release** (lines 52–73):

- `update(dt)`: each frame, lerps focus point toward desired (rider position + lead velocity)
- `release()`: returns to overhead, resets framing

**How reduced motion is passed:**

- `ViewOptions.reducedEffects: boolean` (look.ts:37) flows through all view creation paths
- Not reduced-motion system preference directly; only the `reducedEffects` option is used (app/controller.ts:367: `reducedEffects: settings.get().reducedEffects || context.settings.reducedMotion()`)

---

## 5. The step and the picture

### Timing relationship (NOTES.md:62–67, ADR-0013 consequences)

> "The picture runs a little behind the rules. On screen, a rider crosses each cell along a curve during the step after the rules moved it. Turns read as curves, at the cost of about one cell of lag on average (0.3 s at the starting speed, 0.06 s at top speed)."

**Engine step:**

- Engine tick: 20 ms (TICKS_PER_SECOND = 50)
- Step period: 15 ticks (300 ms) at start, falling to 3 ticks (60 ms) at top speed
- One step: `stepMatch(match, sticks)` (engine/match.ts) advances match state, reports events

**Rendering step:**

- `MatchSession.advance(seconds)` accumulates real time and calls `stepMatch()` (match-session.ts:77–200)
- For each `step` event: `view.step(laid, erased, moves, period_in_seconds)` (line 116)
- View starts a crossing for each seat in `moves` array (trail-rig.ts:166–180, `startRide()`)
  - Crossing spans the period (seconds between steps), interpolating rider along curve
  - `progress` tracks time: `ride.progress = Math.min(ride.reach, ride.progress + dt / ride.seconds)` (line 197)

**Rider position drawn:**

- `placeOnRide(ride, position)` calculates position at current progress (lines 183–192)
  - If progress ≤ 1: rider in the cell, along curve from entry to exit
  - If progress > 1: rider has left cell, extends past at constant heading (for crash overshoot)
- Yaw computed from curve tangent: `Math.atan2(-tangent.z, tangent.x)` (line 200)

**Input timing:**

- `controls.ts` reads sticks from kit input system each tick
- Latch between steps: driver's `stick(match)` called, latched (match-session.ts:58–72 in `advance()` loop)
- Input acts on next step after being read

**Summary:**

- Engine moves rider from cell A to B at step N
- Picture shows rider crossing from A to B during step N+1 (one step = ~300 ms behind)
- This lag allows smooth curves; on average, 0.3 s at start speed, 0.06 s at top speed

---

## 6. Hero page (file: `src/dev/hero.ts`)

**Dev-only page:** `/?dev/hero.html` (served by play.html dev route)

**URL options:**

- `?look=neon|trains|mummy|ice` — which look to render
- `?scene=duel|trap` — two scripted scenes: a tense duel (20 s in) or a trapped opponent
- `?appearance=light|dark`
- `?t=<extra_seconds>` — add time before taking frame
- `?quality=high|medium|low`
- `?measure=1` — render 300 frames, report frame times in `data-stats`
- `?zoom=<factor>&at=<col>,<row>` — close-up on a cell for checking models

**Scenes & frames** (lines 61–140):

```typescript
const STORIES = {
  duel: {
    variation: 1, // 1v1, constant speed
    runs: [[runs0], [runs1]], // Scripted moves as sticks pushed before each step
    step: 66, // Frame taken after step 66
    after: 0.12, // Extra 0.12 s into the glide
  },
  trap: {
    variation: 3, // 1v1, speed-up enabled
    runs: [[runs0], [runs1]],
    step: 65, // Frame taken after step 65
    after: 0.2, // Extra 0.2 s into glide
  },
};
```

**Reaction delay per look** (lines 145–149):

- Neon: 0.25 s (fast reaction)
- Trains: 0.5 s (conductor takes aim or waves)
- Mummy: 0.5 s (priest's reaction)
- Ice: 0.7 s (snowman's reaction)

**How frames are produced:**

1. Headless match runs with scripted rider inputs (lines 154–200)
2. Real engine: `stepMatch()` drives the view
3. At target step + delay, snapshot taken via three.js `renderer.render()`
4. Frame stored as PNG in `/games/trailblaze/docs/media/hero/<look>-<scene>.<appearance>.png`

**Where produced:** Owner's art review (mentioned in results.ts comment, line 2: "for the owner's art review and the README")

---

## 7. Pre-match cards & menu demo

### Pre-match cards (file: `screens/prematch.ts`)

**What they render:**

- Two cards (four in Four Way), one per rider
- Rider portrait: SVG from `kidPortraitSvg(kid)` or `computerPortraitSvg()` (lines 8, 8)
- **Riders NOT modeled in 3D on cards** — portraits are 2D SVG only (line 8)
- Name, role ("you", "player2", "kid", "computer")
- Seat colour as a vertical bar (line 93: `border-left: 6px solid var(--seat)`)
- Trail swatch: static colour block, not animated (implied in UI, no 3D render)
- Difficulty switch position (B/A)
- Controls legend (keyboard/gamepad)
- Look name: "Neon Grid", "Toy Trains", "Mummy's Wrap", "Ice Trail" (lines 33–38)
- Countdown: 3-2-1 before match starts (method `setCount(n)`, line 30)

### Den TV demo (file: `demo/demo.ts`)

**What it renders:**

- Attract loop: full 3D duel at 320×240 (TV size)
- Both riders in the current look
- Continuous play with periodic resets
- Demo is meant to be TV-like: low res, repeating matches
- Called by Hall's Den TV display and by `dev/demo.ts` page

**Framing:** Uses the look's full-board framing, no chase cam

---

## 8. Results screen

### Score building (file: `screens/results.ts:307–356`)

**Title (winner banner):**

```typescript
function winnerBanner(options: ResultsOptions) {
  const scores = options.seats.map((s) => s.score);
  if (options.winner === null) return { title: 'A draw', line: `A draw at ${scores.join('–')}` };
  const winner = options.seats[options.winner];
  const others = options.seats.filter((s) => s !== winner).map((s) => s.score);
  const score = `${winner.score}–${Math.max(...others)}`;
  const people = options.seats.filter((s) => s.isHuman).length;
  if (winner.isHuman && people === 1) return { title: 'You win', line: `You win ${score}` };
  return { title: `${winner.name} wins`, line: `${winner.name} wins ${score}` };
}
```

- Title shows **the winner's score first**, then best of rest: `"10–6"` (line 315)
- Score built from `session.stats.points` (each point awards 1 to its taker, line 39 in share.ts: `playerScore += 1`)

**"Cells claimed"** (line 349–350):

```typescript
const claimedStr = `${s0?.cellsClaimed ?? 0} / ${s1?.cellsClaimed ?? 0}`;
```

- Built from `ResultsSeat.cellsClaimed: number` (line 24)
- Passed in from controller, comes from `MatchSession.stats.cellsLaid[seatIndex]` (match-session.ts:122–123)
- Counts each laid cell once per seat over the whole match (not current round; `cellsLaid` never resets)

### Share line (file: `progress/share.ts:31–48`)

```typescript
export function shareLine(points: readonly PointTaker[], playerSeat: Seat): string {
  let playerScore = 0,
    rivalScore = 0;
  for (const point of points) {
    if (point === playerSeat) playerScore += 1;
    else if (point === 'both') {
      playerScore += 1;
      rivalScore += 1;
    } else rivalScore += 1;
  }
  const symbols = pointSymbols(points, playerSeat);
  return `Trailblaze · ${symbols} · ${playerScore}–${rivalScore}`;
}
```

**Format:** `"Trailblaze · 🟦🟥🟦⬜ · 5–3"`

- Emojis: 🟦 player wins, 🟥 rival wins, ⬜ both crashed
- Score: **player's score first** (line 47)
- Max 7 emojis; older points shown as `…` (share.ts:22–27)

**Why title score and share disagree:**

- **Title score** (results.ts:315): `winner.score – Math.max(...others)` — winner's first, best opponent shown
- **Share score** (share.ts:47): `playerScore – rivalScore` — player's score first (perspective)
- If player wins but wasn't the human rider, scores differ in order

### "Traps sprung"** (line 350)

```typescript
const trapsStr = `${s0?.trapsSprung ?? 0} / ${s1?.trapsSprung ?? 0}`;
```

- Built from `ResultsSeat.trapsSprung: number` (line 25)
- Passed in from controller, counts traps where that seat was sealed in (match-session.ts:126–131, pushed to `traps` array)

---

## 9. Solo Doodle start chevrons

**Where drawn:** `looks/neon/arena.ts:312–331` (all looks use same grid texture generation)

**Code path:**

```typescript
START.forEach((start, seat) => {
  const centre = cellCentre(start.cell);
  const x = (centre.x + HALF_WIDTH) * TEXELS_PER_CELL;
  const y = (centre.z + HALF_DEPTH) * TEXELS_PER_CELL;
  const colour = seats[seat]?.main ?? '#ffffff';
  context.save();
  context.translate(x, y);
  context.rotate(-headingYaw(start.heading));
  context.lineWidth = 5;
  for (const offset of [-14, 0]) {
    context.beginPath();
    context.moveTo(offset - 6, -12);
    context.lineTo(offset + 6, 0);
    context.lineTo(offset - 6, 12);
    context.stroke();
  }
  context.restore();
});
```

**What decides which seats get them:**

- `START` array (imported from `engine/grid.ts`)
- In Trailblaze, always seats 0 and 1 at their canonical start positions:
  - Seat 0: column 10, row 10, heading right
  - Seat 1: column 30, row 10, heading left
- In Solo Doodle (single rider), only the player's seat (0) gets a chevron

**Visual:**

- Two V-shaped marks (chevrons pointing in the rider's heading direction)
- Colour: seat's main colour
- Drawn on the grid texture itself (canvas texture applied to arena floor)
- Positioned at cell centre, rotated to match entry heading
- Opacity: 0.75 (day) or 0.9 (night) (line 321)

---

## Cross-reference: Reduced motion handling

**Where passed:** `ViewOptions.reducedEffects: boolean` (look.ts:37)

- Set from `settings.reducedEffects || context.settings.reducedMotion()` (app/controller.ts:367)
- Flows to all view creation paths: `lookById(id).createView(options)` (look.ts:83)

**How used:**

- **Neon:** Shards and glow only emit at normal effects (neon/view.ts, no code shown but check `burst()`)
- **Trains:** Fewer particles, headlamp effect simplified
- **Mummy:** 4 sand puffs instead of 16, no sparks (mummy/view.ts:170–171), no periodic foot scuffs (line 211), no torch sparks (line 217)
- **Ice:** Same, fewer crystals
- Watcher animations: may run at dt=0 when reduced effects (not explicitly shown per look)

**System preference:**

- Kit's `context.settings.reducedMotion()` checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
- Demo forces reduced motion with `?still=1` param (dev/demo.ts:12)

---

## Summary table: Riders at a glance

| Aspect             | Neon Bikes                  | Toy Trains    | Mummy's Wrap                    | Ice Skaters          |
| ------------------ | --------------------------- | ------------- | ------------------------------- | -------------------- |
| **Built size**     | 1 cell                      | 1 cell        | 1 cell                          | 1 cell               |
| **Draw scale**     | 1.3×                        | 1.3×          | 1.5×                            | 1.45×                |
| **Seat 0 name**    | Lancer                      | Ember         | Wick                            | Juniper              |
| **Seat 1 name**    | Comet                       | Bluebell      | Bun                             | Sorrel               |
| **Placement**      | `ride(pos, yaw, dt, stage)` | Same          | Same                            | Same                 |
| **Yaw source**     | Curve tangent               | Curve tangent | Curve tangent                   | Curve tangent        |
| **Turn animation** | Lean (0.06/rad/s)           | Key spin      | Shuffle + arms                  | Lean + stride        |
| **Crash effect**   | Shards + flash              | Tip + spin    | Cocoon wind + flash             | Fall + slide + frost |
| **Crash duration** | ~0.3 s                      | 0.55 s        | 0.75 s (wind 0.35 + topple 0.4) | ~0.85 s              |
