/**
 * The Den's layout: one 1600×900 "core" composition, laid out on a strict
 * grid, that is always fully visible. Wider or taller windows see more room
 * around it (wall to the sides, carpet below) instead of a stretched or
 * letterboxed picture. Every object's position lives here so the scene, the
 * HTML overlays (CRT, game card) and the tests agree.
 */

export const CORE = { width: 1600, height: 900 } as const;

/** Where the back wall meets the carpet. */
export const FLOOR_Y = 700;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const LAYOUT = {
  door: rect(40, 160, 172, 540),
  jacket: rect(64, 232, 128, 250),
  calendar: rect(232, 168, 92, 148),
  stand: rect(340, 462, 520, 238),
  compartment: rect(362, 500, 476, 186),
  tv: rect(366, 176, 420, 288),
  /** The picture area inside the bezel, 4:3. */
  screen: rect(384, 196, 296, 222),
  lamp: rect(796, 296, 64, 168),
  console: rect(378, 598, 326, 86),
  powerLever: rect(398, 548, 44, 64),
  resetLever: rect(450, 556, 36, 56),
  cartridgeSlot: rect(500, 540, 96, 66),
  switches: rect(616, 584, 52, 24),
  /** The Counter stands on the shelf beside the console, on the same baseline. */
  counter: rect(718, 552, 110, 132),
  shelf: rect(880, 206, 700, 494),
  window: rect(902, 72, 656, 116),
  clock: rect(796, 96, 80, 80),
  /** On the stand's top rail under the lamp; its lower half hangs over the open shelf. */
  stickyNote: rect(774, 468, 82, 68),
  pothos: rect(1484, 150, 80, 300),
  rug: rect(330, 734, 540, 152),
  pads: rect(470, 752, 270, 96),
  beanbag: rect(1176, 708, 290, 182),
  /** Asleep on the carpet, tucked against the beanbag's side (its box is 180×100 at scale 1). */
  cat: rect(1030, 778, 170, 94),
  /** Where the HTML game card floats, bottom left. */
  card: rect(24, 566, 306, 320),
} as const;

/** The Label Wall: four rows of up to nine cartridges. */
export const WALL = {
  innerX: LAYOUT.shelf.x + 16,
  innerWidth: LAYOUT.shelf.width - 32,
  firstRowY: LAYOUT.shelf.y + 16,
  rowHeight: 119,
  columns: 9,
  cartridge: { width: 68, height: 96 },
  label: { width: 62, height: 48.7, inset: 3, top: 5 },
  boardHeight: 12,
} as const;

export function wallSlot(row: number, column: number): Rect {
  const pitch = WALL.innerWidth / WALL.columns;
  const x = WALL.innerX + column * pitch + (pitch - WALL.cartridge.width) / 2;
  const shelfTop = WALL.firstRowY + row * WALL.rowHeight;
  const y = shelfTop + WALL.rowHeight - WALL.boardHeight - WALL.cartridge.height;
  return rect(x, y, WALL.cartridge.width, WALL.cartridge.height);
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Fit {
  /** CSS pixels per scene unit. */
  scale: number;
  /** The SVG viewBox showing the core centred with extra room around it. */
  viewBox: Rect;
}

/** Fits the core into the viewport without cropping it; the rest of the window shows more room. */
export function fitCore(viewport: Viewport): Fit {
  const scale = Math.min(viewport.width / CORE.width, viewport.height / CORE.height);
  const width = viewport.width / scale;
  const height = viewport.height / scale;
  return {
    scale,
    viewBox: rect((CORE.width - width) / 2, (CORE.height - height) / 2, width, height),
  };
}

/** Converts a scene rectangle to CSS pixels inside the stage, for HTML overlays. */
export function toScreen(target: Rect, fit: Fit): Rect {
  return rect(
    (target.x - fit.viewBox.x) * fit.scale,
    (target.y - fit.viewBox.y) * fit.scale,
    target.width * fit.scale,
    target.height * fit.scale,
  );
}
