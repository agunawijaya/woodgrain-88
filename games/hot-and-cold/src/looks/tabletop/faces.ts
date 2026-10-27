/**
 * The Tabletop tiles' painted faces, drawn once per view on canvases: the
 * shared back (deep teal with gold rings, like the cartridge label's rings),
 * and every face a tile can show — numerals painted in warm-to-cool inks, an
 * arrow for each of the eight bearings, the cartoon bomb, and the gold star
 * under the flag.
 */
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { BEARINGS, bearingDegrees, type Bearing } from '../../engine/grid.ts';
import { LEGIBLE_FONT } from '../../look/glyphs.ts';
import { heatInk, type HeatPalette } from '../../look/heat.ts';

const SIZE = 256;

export const TILE_CREAM = '#f4ead2';
const NAVY = '#22304a';

export interface TileFaces {
  readonly back: CanvasTexture;
  numeral(distance: number): CanvasTexture;
  arrow(bearing: Bearing): CanvasTexture;
  readonly bomb: CanvasTexture;
  readonly star: CanvasTexture;
  dispose(): void;
}

export function createTileFaces(palette: HeatPalette): TileFaces {
  const made: CanvasTexture[] = [];
  const paint = (draw: (context: CanvasRenderingContext2D) => void): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 8;
    const redraw = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      draw(context);
      texture.needsUpdate = true;
    };
    redraw();
    void document.fonts.load(`800 64px ${LEGIBLE_FONT}`).then(redraw, () => undefined);
    made.push(texture);
    return texture;
  };

  const back = paint(paintBack);
  const numerals = new Map<number, CanvasTexture>();
  const arrows = new Map<Bearing, CanvasTexture>();
  for (const bearing of BEARINGS)
    arrows.set(
      bearing,
      paint((c) => paintArrow(c, bearing)),
    );
  const bomb = paint(paintBomb);
  const star = paint(paintStar);

  return {
    back,
    numeral(distance) {
      const clamped = Math.min(8, Math.max(1, distance));
      let texture = numerals.get(clamped);
      if (!texture) {
        texture = paint((context) => paintNumeral(context, clamped, palette));
        numerals.set(clamped, texture);
      }
      return texture;
    },
    arrow(bearing) {
      return arrows.get(bearing) ?? back;
    },
    bomb,
    star,
    dispose() {
      for (const texture of made) texture.dispose();
    },
  };
}

function paintBack(context: CanvasRenderingContext2D): void {
  const middle = SIZE / 2;
  const ground = context.createRadialGradient(
    middle,
    middle * 0.8,
    10,
    middle,
    middle,
    SIZE * 0.75,
  );
  ground.addColorStop(0, '#2b6f7e');
  ground.addColorStop(1, '#174654');
  context.fillStyle = ground;
  context.fillRect(0, 0, SIZE, SIZE);
  // Gold rings, the hunt's signature: closer and closer to the middle.
  context.strokeStyle = '#e2b44f';
  for (const [radius, width] of [
    [92, 6],
    [70, 5],
    [50, 4],
    [31, 4],
  ] as const) {
    context.lineWidth = width;
    context.beginPath();
    context.arc(middle, middle, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = '#f2cf72';
  context.beginPath();
  context.arc(middle, middle, 11, 0, Math.PI * 2);
  context.fill();
  insetBorder(context, '#e2b44f', 3, 14);
}

function cream(context: CanvasRenderingContext2D): void {
  const ground = context.createLinearGradient(0, 0, SIZE, SIZE);
  ground.addColorStop(0, '#f8f0dc');
  ground.addColorStop(1, '#efe2c4');
  context.fillStyle = ground;
  context.fillRect(0, 0, SIZE, SIZE);
  insetBorder(context, '#cdb88d', 4, 14);
}

function insetBorder(
  context: CanvasRenderingContext2D,
  colour: string,
  width: number,
  inset: number,
): void {
  context.strokeStyle = colour;
  context.lineWidth = width;
  roundedRect(context, inset, inset, SIZE - inset * 2, SIZE - inset * 2, 16);
  context.stroke();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function paintNumeral(
  context: CanvasRenderingContext2D,
  distance: number,
  palette: HeatPalette,
): void {
  cream(context);
  // A face built for legibility: no 3 that could pass for a 5 at a glance.
  context.font = `800 ${SIZE * 0.7}px ${LEGIBLE_FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const ink = heatInk(distance, palette);
  // A soft shadow of thicker paint under the numeral, then the numeral itself.
  context.fillStyle = 'rgba(60, 40, 20, 0.22)';
  context.fillText(String(distance), SIZE / 2 + 4, SIZE / 2 + 18);
  context.fillStyle = ink;
  context.fillText(String(distance), SIZE / 2, SIZE / 2 + 14);
}

function paintArrow(context: CanvasRenderingContext2D, bearing: Bearing): void {
  cream(context);
  context.save();
  context.translate(SIZE / 2, SIZE / 2);
  context.rotate((bearingDegrees(bearing) * Math.PI) / 180);
  const shaft = 30;
  const head = 74;
  context.beginPath();
  context.moveTo(-shaft / 2, 78);
  context.lineTo(shaft / 2, 78);
  context.lineTo(shaft / 2, -14);
  context.lineTo(head / 2, -14);
  context.lineTo(0, -88);
  context.lineTo(-head / 2, -14);
  context.lineTo(-shaft / 2, -14);
  context.closePath();
  context.lineJoin = 'round';
  context.fillStyle = 'rgba(60, 40, 20, 0.22)';
  context.translate(4, 5);
  context.fill();
  context.translate(-4, -5);
  context.fillStyle = NAVY;
  context.strokeStyle = NAVY;
  context.lineWidth = 8;
  context.fill();
  context.stroke();
  context.restore();
}

function paintBomb(context: CanvasRenderingContext2D): void {
  cream(context);
  const middle = SIZE / 2;
  // A red starburst behind the bomb.
  context.fillStyle = '#e4572e';
  context.beginPath();
  for (let point = 0; point < 24; point++) {
    const angle = (point / 24) * Math.PI * 2;
    const reach = point % 2 === 0 ? 108 : 70;
    context.lineTo(middle + Math.cos(angle) * reach, middle + 8 + Math.sin(angle) * reach);
  }
  context.closePath();
  context.fill();
  context.fillStyle = '#1c1c22';
  context.beginPath();
  context.arc(middle, middle + 18, 56, 0, Math.PI * 2);
  context.fill();
  context.fillRect(middle - 18, middle - 52, 36, 26);
  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  context.beginPath();
  context.ellipse(middle - 20, middle - 4, 16, 10, -0.6, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#7a5a34';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(middle, middle - 52);
  context.quadraticCurveTo(middle + 24, middle - 84, middle + 48, middle - 74);
  context.stroke();
  context.fillStyle = '#ffd23f';
  context.beginPath();
  context.arc(middle + 50, middle - 76, 10, 0, Math.PI * 2);
  context.fill();
}

function paintStar(context: CanvasRenderingContext2D): void {
  cream(context);
  const middle = SIZE / 2;
  context.fillStyle = '#d9a52b';
  context.strokeStyle = '#9c6f12';
  context.lineWidth = 5;
  context.beginPath();
  for (let point = 0; point < 16; point++) {
    const angle = (point / 16) * Math.PI * 2 - Math.PI / 2;
    const reach = point % 4 === 0 ? 100 : point % 2 === 0 ? 50 : 34;
    context.lineTo(middle + Math.cos(angle) * reach, middle + Math.sin(angle) * reach);
  }
  context.closePath();
  context.fill();
  context.stroke();
}
