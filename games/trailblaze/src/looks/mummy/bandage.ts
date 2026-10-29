/**
 * Mummy's Wrap's trails: each mummy unrolls an endless bandage behind it,
 * the way a roll of tissue unrolls when it is thrown along the floor: a long
 * strip of linen lying on the tomb flags, its edges curling up, following
 * the mummy's own path so it bends round every turn the way a walker does.
 * The edges are dyed in the mummy's colour, orange for Wick and blue for Bun,
 * so the two strips are told apart at a glance.
 *
 * The curled edges stand about ankle high, enough for the strip to read as
 * something you cannot walk through.
 */
import {
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Material,
  type Texture,
} from 'three';
import type { SeatColours } from '../../look/look.ts';
import { sweepSection } from '../../look/sweep.ts';
import { createSweptTrail, type SweptLayer, type SweptTrail } from '../../look/swept-trail.ts';

export const FLOOR_TOP = 0.02;
const STRIP_WIDTH = 0.66;
const EDGE_CURL = 0.16;

/** Across the strip, from one edge to the other: flat in the middle, curling up at both edges. */
const STRIP = Array.from({ length: 11 }, (_, index) => {
  const across = index / 5 - 1;
  return new Vector2((across * STRIP_WIDTH) / 2, FLOOR_TOP + 0.015 + EDGE_CURL * across ** 4);
});

export function createBandages(options: { readonly seats: readonly SeatColours[] }): SweptTrail {
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const layersFor = (colours: SeatColours): SweptLayer[] => {
    const texture = clothTexture(colours.main);
    textures.push(texture);
    const cloth = new MeshStandardMaterial({ map: texture, roughness: 0.92, side: DoubleSide });
    materials.push(cloth);
    return [
      {
        build: (path) => sweepSection(path, STRIP, { closed: false, uPerUnit: 2 }),
        material: cloth,
        castShadow: true,
        receiveShadow: true,
      },
    ];
  };
  const trail = createSweptTrail({
    seats: options.seats.map((colours) => layersFor(colours)),
  });
  return {
    ...trail,
    dispose() {
      trail.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

/**
 * Old linen, cream with a fine weave and a few creases, its two long edges dyed with a band of
 * colour. Maps once across a strip (v) and once along each half cell (u). `repeat` tiles it, for a
 * cocoon.
 */
export function clothTexture(dye: string, repeat = 1): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the cloth');
  context.fillStyle = '#f0e6cd';
  context.fillRect(0, 0, size, size);
  for (let line = 0; line < size; line += 3) {
    context.fillStyle = line % 6 === 0 ? 'rgba(120, 96, 60, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    context.fillRect(0, line, size, 1);
    context.fillRect(line, 0, 1, size);
  }
  context.strokeStyle = 'rgba(150, 120, 80, 0.25)';
  context.lineWidth = 2;
  for (const x of [22, 70, 104]) {
    context.beginPath();
    context.moveTo(x, 24);
    context.lineTo(x + 6, 104);
    context.stroke();
  }
  context.fillStyle = dye;
  context.fillRect(0, 0, size, 18);
  context.fillRect(0, size - 18, size, 18);
  context.fillStyle = 'rgba(255, 255, 255, 0.25)';
  context.fillRect(0, 18, size, 3);
  context.fillRect(0, size - 21, size, 3);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}
