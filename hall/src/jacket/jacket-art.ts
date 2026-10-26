/**
 * The denim jacket, front and back, drawn in the 600×700 units the patch
 * layout uses (arrange.ts), so a patch's coordinates land on the same seam
 * in the drawing that they mean in the model.
 *
 * It is a trucker-style jacket: pointed yokes, flap chest pockets with
 * pleat seams below them, a buttoned placket, a waistband with side tabs,
 * buttoned cuffs. The cloth is a twill pattern with a little grain and
 * stone-washed fading in the middle of each panel; every seam is double
 * stitched in copper thread. The left half is drawn once and mirrored for
 * the right, then the asymmetric parts (placket, buttons) go on top.
 *
 * Day and night are two looks, not a filter: by day the denim is a washed
 * mid-blue under the window's light; at night it is darker, with the desk
 * lamp's warm pool falling across the left shoulder.
 */
import { n } from '../den/svg.ts';

export type JacketSide = 'front' | 'back';

const STITCH = 'var(--jacket-thread)';
const SEAM = 'var(--jacket-seam)';

/** Two rows of running stitch either side of a seam line, the way denim is topstitched. */
function topstitch(d: string, gap = 3.2): string {
  return (
    `<path d="${d}" fill="none" stroke="${SEAM}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" transform="translate(${-gap / 2} ${-gap / 2})" fill="none" stroke="${STITCH}" stroke-width="1.3" stroke-dasharray="4.2 2.6" stroke-linecap="round"/>` +
    `<path d="${d}" transform="translate(${gap / 2} ${gap / 2})" fill="none" stroke="${STITCH}" stroke-width="1.3" stroke-dasharray="4.2 2.6" stroke-linecap="round"/>`
  );
}

/** A single row of stitching just inside an edge. */
function edgestitch(d: string): string {
  return `<path d="${d}" fill="none" stroke="${STITCH}" stroke-width="1.3" stroke-dasharray="4.2 2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function button(cx: number, cy: number, r = 9): string {
  return (
    `<circle cx="${cx}" cy="${n(cy + 1.6)}" r="${r}" fill="#000" opacity="0.35"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#jacket-copper)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.62)}" fill="none" stroke="#5a2e12" stroke-width="1" opacity="0.6"/>` +
    `<circle cx="${n(cx - r * 0.3)}" cy="${n(cy - r * 0.35)}" r="${n(r * 0.28)}" fill="#fff" opacity="0.45"/>`
  );
}

function rivet(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="3.4" fill="url(#jacket-copper)"/><circle cx="${n(cx - 1)}" cy="${n(cy - 1)}" r="1" fill="#fff" opacity="0.5"/>`;
}

export function jacketDefs(): string {
  return (
    // Twill: fine diagonal wales in two blues, turned the way denim's weave runs.
    `<pattern id="jacket-twill" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">` +
    `<rect width="5" height="5" fill="var(--jacket-denim)"/>` +
    `<rect width="5" height="1.7" fill="var(--jacket-denim-dark)" opacity="0.55"/>` +
    `<rect y="3" width="5" height="0.6" fill="#fff" opacity="0.07"/>` +
    `</pattern>` +
    `<filter id="jacket-grain" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="11"/>` +
    `<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.13 0"/>` +
    `<feComposite in2="SourceAlpha" operator="in"/>` +
    `</filter>` +
    `<filter id="jacket-slub" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves="2" seed="4"/>` +
    `<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.16 -0.04"/>` +
    `<feComposite in2="SourceAlpha" operator="in"/>` +
    `</filter>` +
    // Stone-washed fading: lighter where the cloth rubbed, in the middle of each panel.
    `<radialGradient id="jacket-fade" cx="0.5" cy="0.45" r="0.55">` +
    `<stop offset="0" stop-color="#fff" style="stop-opacity: var(--jacket-fade-strength, 0.2)"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="jacket-side-shade" x1="0" x2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0.32"/><stop offset="0.2" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="0.8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.32"/>` +
    `</linearGradient>` +
    `<radialGradient id="jacket-copper" cx="0.35" cy="0.3" r="0.8">` +
    `<stop offset="0" stop-color="#f6c27a"/><stop offset="0.5" stop-color="#b8692c"/><stop offset="1" stop-color="#6b3414"/>` +
    `</radialGradient>` +
    // The night's desk lamp, from above on the left.
    `<radialGradient id="jacket-lamp" cx="0.18" cy="0.12" r="0.85">` +
    `<stop offset="0" stop-color="#ffcf8a" stop-opacity="0.62"/><stop offset="0.4" stop-color="#ffa95a" stop-opacity="0.22"/><stop offset="1" stop-color="#ffa95a" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="jacket-night-falloff" cx="0.2" cy="0.15" r="1.05">` +
    `<stop offset="0" stop-color="#070912" stop-opacity="0.16"/><stop offset="0.35" stop-color="#070912" stop-opacity="0.36"/><stop offset="0.7" stop-color="#070912" stop-opacity="0.58"/><stop offset="1" stop-color="#070912" stop-opacity="0.74"/>` +
    `</radialGradient>`
  );
}

// ——— Shapes (left half; the right is the mirror) ———

const SLEEVE = 'M102 104C72 110 48 136 40 178C30 300 22 440 16 566L14 606Q56 616 100 610L104 566L108 214C106 168 104 130 102 104Z';
const CUFF = 'M16 566L104 566L100 610Q56 616 14 606Z';
const BODY =
  'M244 76L104 106C100 150 104 190 108 214L110 640Q300 654 490 640L492 214C496 190 500 150 496 106L356 76Q300 92 244 76Z';

/** The parts of the front's left half: sleeve, yoke, pocket, pleats, hand pocket, collar point. */
function frontHalf(): string {
  return (
    // Sleeve fold and elbow creases, then the cuff and its button.
    `<path d="M66 150C56 250 50 360 46 470" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M30 380q22 8 66 2M28 410q20 6 64 4" fill="none" stroke="#000" stroke-opacity="0.14" stroke-width="2.4" stroke-linecap="round"/>` +
    edgestitch('M18 571L102 571') +
    button(58, 590, 7) +
    // Pointed front yoke, from the armhole down to the pocket and up to the placket.
    topstitch('M106 164L198 184L288 150') +
    // Chest pocket: pocket seam, pointed flap, its button and the rivets at its corners.
    edgestitch('M156 214V292H256V214') +
    `<path d="M148 190H262V216L205 240L148 216Z" fill="url(#jacket-twill)"/>` +
    `<path d="M148 190H262V216L205 240L148 216Z" fill="#000" opacity="0.08"/>` +
    `<path d="M148 216L205 240L262 216" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>` +
    edgestitch('M152 194H258V214L205 235L152 214Z') +
    button(205, 222, 8) +
    rivet(160, 296) +
    rivet(252, 296) +
    // Pleat seams under the pocket, down to the waistband.
    topstitch('M170 292L172 598') +
    topstitch('M242 292L244 598') +
    // Welt hand pocket low on the side.
    `<path d="M120 430L146 520" stroke="#000" stroke-opacity="0.4" stroke-width="3" stroke-linecap="round"/>` +
    edgestitch('M126 428L152 518') +
    edgestitch('M114 432L140 522') +
    // Side seam, armhole seam and the waistband with its adjuster tab.
    topstitch('M108 214L110 598') +
    topstitch('M104 106C100 150 104 190 108 214', 2.6) +
    `<path d="M110 598H290" stroke="#000" stroke-opacity="0.3" stroke-width="2"/>` +
    edgestitch('M112 603H288M112 634H288') +
    `<path d="M114 606h46v24h-46Z" fill="#000" opacity="0.14"/>` +
    edgestitch('M118 609h38v18h-38Z') +
    button(146, 618, 6.5) +
    // The collar point, lying open on the yoke.
    `<path d="M246 78Q236 104 196 156L272 168L296 116Q270 100 262 80Z" fill="url(#jacket-twill)"/>` +
    `<path d="M246 78Q236 104 196 156L272 168L296 116Q270 100 262 80Z" fill="#000" opacity="0.1"/>` +
    `<path d="M196 156L272 168L296 116" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2.2"/>` +
    edgestitch('M246 88Q238 108 206 152L268 162L288 120')
  );
}

function backHalf(): string {
  return (
    `<path d="M66 150C56 250 50 360 46 470" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M30 384q22 8 66 2M28 414q20 6 64 4" fill="none" stroke="#000" stroke-opacity="0.14" stroke-width="2.4" stroke-linecap="round"/>` +
    edgestitch('M18 571L102 571') +
    // The cuff's placket slit, seen from behind.
    `<path d="M74 566L76 534" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>` +
    edgestitch('M79 566L81 534') +
    button(64, 590, 7) +
    // Back yoke: a shallow point at the centre.
    topstitch('M108 200L300 214') +
    // Pleats from the yoke to the waistband.
    topstitch('M204 205L206 598') +
    topstitch('M108 214L110 598') +
    topstitch('M104 106C100 150 104 190 108 214', 2.6) +
    `<path d="M110 598H300" stroke="#000" stroke-opacity="0.3" stroke-width="2"/>` +
    edgestitch('M112 603H300M112 634H300') +
    // Side adjuster tab with its button.
    `<path d="M112 606h56l6 12-6 12h-56Z" fill="#000" opacity="0.14"/>` +
    edgestitch('M116 609h50l4 9-4 9h-50Z') +
    button(156, 618, 6.5)
  );
}

const mirrored = (markup: string) => `<g transform="translate(600 0) scale(-1 1)">${markup}</g>`;

function cloth(shape: string): string {
  return (
    `<path d="${shape}" fill="url(#jacket-twill)"/>` +
    `<path d="${shape}" fill="url(#jacket-fade)"/>` +
    `<path d="${shape}" fill="#fff" filter="url(#jacket-slub)"/>` +
    `<path d="${shape}" fill="#fff" filter="url(#jacket-grain)"/>`
  );
}

function silhouette(): string {
  return (
    // Sleeves hang behind the body, a shade darker where they turn away.
    cloth(SLEEVE) +
    `<path d="${SLEEVE}" fill="#000" opacity="0.14"/>` +
    mirrored(cloth(SLEEVE) + `<path d="${SLEEVE}" fill="#000" opacity="0.14"/>`) +
    `<path d="${CUFF}" fill="#000" opacity="0.1"/>` +
    mirrored(`<path d="${CUFF}" fill="#000" opacity="0.1"/>`) +
    `<path d="${BODY}" fill="#000" opacity="0.35" transform="translate(4 8)"/>` +
    cloth(BODY) +
    `<path d="${BODY}" fill="url(#jacket-side-shade)"/>`
  );
}

function front(): string {
  return (
    silhouette() +
    // The dark inside of the neck, behind the collar.
    `<path d="M244 76Q300 60 356 76Q330 116 300 120Q270 116 244 76Z" fill="var(--jacket-lining)"/>` +
    `<path d="M252 80Q300 70 348 80" fill="none" stroke="${STITCH}" stroke-width="1.2" stroke-dasharray="3.6 2.4"/>` +
    // The hanger crosses the open collar in front of the lining; the collar points cover the arms' ends.
    hookAndNeck(HANGER_JOIN.y) +
    armRoots(60) +
    frontHalf() +
    mirrored(frontHalf()) +
    // Placket: the right front laps over the left, buttoned down the middle.
    `<path d="M288 118H314V640H288Z" fill="url(#jacket-twill)"/>` +
    `<path d="M314 118V640" stroke="#000" stroke-opacity="0.35" stroke-width="2.4"/>` +
    edgestitch('M291 122V636') +
    edgestitch('M310 122V636') +
    `<path d="M288 598H314" stroke="#000" stroke-opacity="0.3" stroke-width="2"/>` +
    [176, 262, 348, 434, 520, 618].map((y) => button(300, y)).join('')
  );
}

function back(): string {
  return (
    // Seen from behind, the hook rises over the collar stand and the rest is inside.
    hookAndNeck(100) +
    silhouette() +
    // The collar stand seen from behind.
    `<path d="M240 74Q300 56 360 74L356 100Q300 86 244 100Z" fill="url(#jacket-twill)"/>` +
    `<path d="M240 74Q300 56 360 74L356 100Q300 86 244 100Z" fill="#000" opacity="0.16"/>` +
    edgestitch('M246 80Q300 64 354 80') +
    edgestitch('M248 94Q300 82 352 94') +
    backHalf() +
    mirrored(backHalf()) +
    // A maker's tab on the back yoke, plain: our jackets carry no brand.
    `<rect x="284" y="226" width="32" height="14" rx="1.5" fill="#b0452a"/>` +
    edgestitch('M287 229h26v8h-26Z')
  );
}

/** The light falling on it: the window by day; the desk lamp's pool and a darker room at night. */
function lighting(): string {
  return (
    `<g class="jacket-day-light"><path d="M0 0H600V700H0Z" fill="url(#jacket-fade)" opacity="0.35"/></g>` +
    `<g class="jacket-night-light">` +
    `<path d="M0 0H600V700H0Z" fill="url(#jacket-night-falloff)"/>` +
    `<path d="M0 0H600V700H0Z" fill="url(#jacket-lamp)" style="mix-blend-mode: screen"/>` +
    `</g>`
  );
}

/** The jacket's cloth and seams for one side; patches are laid over it by the caller, then `jacketLight`. */
export function jacketCloth(side: JacketSide): string {
  return `<g class="jacket-cloth">${peg()}${side === 'front' ? front() : back()}</g>`;
}

/** The lighting pass, clipped to the jacket by the caller and drawn over the patches too. */
export function jacketLight(): string {
  return lighting();
}

/** The jacket's outline, for clipping the light and for the drop shadow. */
export function jacketOutline(): string {
  return `<path d="${SLEEVE}"/><path d="${SLEEVE}" transform="translate(600 0) scale(-1 1)"/><path d="${BODY}"/>`;
}

// ——— The hanger ———
// The same wire hanger as on the Den's door, at this size: a hook over a
// brass peg, a neck down into the collar, and two arms that run inside the
// jacket under its shoulders. From the front, the neck and the roots of the
// arms show where they cross the open collar; from the back, only the hook
// and the top of the neck above the collar.

const WIRE = 'var(--den-chrome-dark)';
const WIRE_WIDTH = 6;
/** Where the neck meets the arms, just inside the collar. */
const HANGER_JOIN = { x: 300, y: 86 };
/** The arms fall 0.3 units for every unit out, below the shoulder line all the way. */
const ARM_SLOPE = 0.3;

function wire(d: string): string {
  return (
    `<path d="${d}" fill="none" stroke="${WIRE}" stroke-width="${WIRE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" transform="translate(-1.4 -1.2)" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function peg(): string {
  return (
    `<ellipse cx="313" cy="-14" rx="12" ry="5" fill="#000" opacity="0.22"/>` +
    `<circle cx="312" cy="-20" r="9" fill="url(#jacket-copper)"/>` +
    `<circle cx="309" cy="-23" r="2.6" fill="#fff" opacity="0.45"/>`
  );
}

/** The hook over the peg and the neck down to the given depth. */
function hookAndNeck(toY: number): string {
  return wire(`M${HANGER_JOIN.x} ${toY}V-12C${HANGER_JOIN.x} -40 328 -42 326 -14`);
}

function armRoots(reach: number): string {
  const { x, y } = HANGER_JOIN;
  return wire(`M${x - reach} ${y + reach * ARM_SLOPE}L${x} ${y}L${x + reach} ${y + reach * ARM_SLOPE}`);
}
