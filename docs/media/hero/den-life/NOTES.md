# Den Life — hero frames (owner checkpoint, prompt 01 stage 4)

Live screens from the running Hall (`pnpm dev`, port 4488) on the dev showcase profile, captured at
1920×1080 with Chromium on the GPU. Nothing is a mockup: the jacket, patches, Polaroids, chalkboard,
posters, trophies and lights are all drawn by code (SVG), the TV picture by the WebGL CRT.

The showcase only exists in dev builds (`?showcase=full|mid|new`); the build check proves it never
reaches `hall/dist`. `full` deliberately earns every growth item at once (every patch, all 32 lamps,
a 104-day best streak, Block champion, 12 Versus series), so the room can be judged fully grown;
`mid` is the halfway profile the prompt describes.

| Frame | File | URL | What it shows |
|---|---|---|---|
| a | `a-jacket-front-day.png` | `?showcase=full#/jacket`, light | The jacket full of patches, front, by day |
| a′ | `a-jacket-front-night.png` | same, dark | The same jacket at night, under the desk lamp |
| b | `b-den-grown-night.png` | `?showcase=full#/`, dark | The grown Den by night |
| b′ | `b-den-grown-day.png` | same, light | The grown Den by day |
| c | `c-versus-mid-series-day.png` | `?showcase=full#/versus`, light | Versus Night mid-series on the chalkboard |
| d | `d-run-transition-night.png` | `?showcase=full#/run`, dark | A Power Cycle Run flip mid-snow, the goal card in |
| e | `e-kids-ladder-day.png` | `?showcase=mid#/kids`, light | The Kids: Polaroids and the Block Ladder |

## a — The jacket, front, by day

The denim jacket from the door, hung on the same wire hanger as on the Den's door, its hook over a brass peg on the pine panelling; the hanger's arms are inside the jacket, so only the hook, the neck and the arms' roots in the open collar show. It is a
trucker jacket drawn in the patch layout's own 600×700 units: pointed yokes, flap chest pockets with
rivets, pleat seams, a buttoned placket with copper buttons, waistband tabs and buttoned cuffs, all
double-stitched in copper thread over a twill weave with a little grain and stone-wash fading.
Auto-arrange has sewn the earned patches: two columns either side of the placket and the small kind
down each sleeve. Every patch comes off the same generator (kit `patch-art`): round Club, shield Pro,
star-edged Legend, hexagonal secret, merrowed borders, satin-stitched emblems, gold thread on some.
The drawer on the right lists every patch of every game, filterable by game, family, tier and gold;
earned ones drag onto the jacket, locked ones wait as dashed outlines with their goal.

**a′, at night:** the denim darkens towards the edges and the desk lamp's warm pool falls across the
left shoulder; the panelling goes dark brown under the same lamp.

## b — The grown Den by night

Everything the room can grow, all at once, with the TV, the Counter and the labels still clear:
the four family posters above the door and calendar; the paper chain across the window (7 days),
string lights along every shelf (30) and the ON AIR sign glowing red on the TV (100); trophies in the
short Duels and Brain rows; the Polaroid corkboard with the Block champion's rosette; the brass
"32 in 1" plaque on the Counter and the woodgrain remote on the TV (all 32 lamps); and the teal
second beanbag off the right edge, with the cat moved onto it (10 Versus series). The door jacket
wears the front of the real jacket in miniature. The calendar ticks off the month (two snow-day
flakes), with "34 · best 104" on its sticker. The chalkboard by the stand shows tonight's series.
The difficulty switches now read A and B, and the console says DIFFICULTY.

**b′, by day:** the same room in the window's light.

## c — Versus Night, mid-series, by day

Robin 2, Sam 1, best of 5, game 4 drawn. The big chalkboard has the same face as the little one in
the Den (one drawing, two sizes): names, tallies, "best of 5" in the corner and "now: Crown Jump",
with a chalk grain over everything and blurred dust where earlier nights were rubbed out. Below it,
the raffle shelf: the pool's cartridges filed close together like a box of them, the drawn one
lifted and glowing; then the button into the game. Rivalries by pair of names on the right.

## d — A Power Cycle Run flip, mid-snow, by night

Round 3 of 5: the room has dimmed, the lever has thrown itself, the next cartridge (Shore Battery)
has dropped into the slot, the Counter has flipped to 18 and the set is warming up through snow,
the picture still rolling into place. The goal card has dropped into the game card's corner:
"Round 3 of 5 · Shore Battery · Survive the whole 45 seconds", with Go and End the run. The HUD
shows the run so far: one done, one missed, this one, two to come, 240 points. Each flip is 15%
faster than the last. (Showcase goals are made up per family; real games supply their own.)

## e — The Kids, by day

The six Neighbourhood Kids pinned up large on cork, in Block Ladder order, each school photo with a
lined index card: how they play, a short bio in our words, and your record against them across every
game. A gold star marks a kid you have beaten. On the right, the Block Ladder from Pip at the foot to
Grandpa Lou at the top: four rungs climbed in gold, an arrow at Moss ("Next up"), and a small gold
"A" beside Pip, beaten with the switch on A.

## Critique rounds

1. **First captures.** Jacket: pale rectangles round the sleeves and body (the grain filters
   filled their whole region), patches uniform like a badge board. Kids: half the corkboard empty,
   ladder names clipped by the panel and the right rail. Versus: chalk tallies thin as pencil, the
   rubbed-out ghosts read as clouds, 24 cartridges spilled into two rows off the screen. Den: the
   small chalkboard's corner note ran into its title.
2. **Fixes.** Grain composited inside the cloth; patch sizes by tier (Legend largest). Kids cards
   enlarged and spread; ladder rebuilt with names beside it. Chalk grain mask and blurred dust;
   tallies thicker; the raffle shelf filed into one overlapping row; the board fitted above the
   fold.
3. **Night and edges.** Jacket night barely darker than day: deeper falloff, a warmer lamp pool,
   less stone-wash at night. Sleeve patches overhung the sleeve: sleeve zones moved in, sleeve
   patches drawn at three quarters size. Versus: names and tallies rebalanced, "best of 5" moved to
   a corner.
4. **Den, grown.** The small chalkboard was illegible under grain at room scale: grain and the
   corner note now only on the big board. The game card said "Patches 0 / 0" in the showcase: it
   now counts from Den Life's patch definitions. Board-game boxes no longer sit under the Brain
   row's trophies. AM · PRO on the console became DIFFICULTY.
5. **Detail pass at 2×.** Collar, placket and rivets on the jacket; calendar ticks, snow flakes and
   the today ring; Polaroid tacks and the rosette; the cat settled in the teal beanbag's dent; the
   run frame caught earlier in the snow (140 ms) so the picture is still rolling. No further
   defects found.
6. **Owner's review.** Grandpa Lou had a pale ring above his head: the shine meant for his bald
   crown sat above the head, and Benny's hair shine had the same fault; both now sit on the head.
   Every kid but Rosa had the same smile; each now smiles, wins and loses their own way (Dee's
   gap-toothed grin, Moss's small closed smile with a dimple, Pip's open laugh, Grandpa Lou's smile
   under a moustache, Rosa's braces, Benny's two big front teeth). The hanger was a wooden one
   showing behind the jacket on the Jacket screen and a wire one whose arms peeked above the
   shoulders on the door: both are now the same wire hanger with its arms inside the jacket. The
   seam cap on top of both beanbags stuck out past the bag's outline: it now sits under the crest
   and is clipped to the bag.
7. **Owner's second review of the Kids.** Pip's curls were a hollow ring with the backdrop showing
   between them and the forehead, and the tongue sat below the mouth: the curls now grow from a
   solid mop on the scalp, and every tongue is clipped inside its open mouth. Dee's spikes stopped
   short above the ears and stuck out past the head: they now come down the sides to the ears.
   Grandpa Lou's grey fringe stood out from the head like wings: it now lies flat on the sides of
   his head, inside its outline, set a touch wider apart on the owner's last note. Checked on
   320×400 renders of every kid in all three expressions.
