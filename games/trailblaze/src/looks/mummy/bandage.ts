/**
 * Mummy's Wrap's trails: each mummy unrolls an endless bandage behind it,
 * the way a roll of tissue unrolls when it is thrown along the floor: a long
 * strip of linen lying on the tomb flags, its edges curling up, following
 * the mummy's own path so it bends round every turn the way a walker does.
 * The linen is dyed in the mummy's colour and woven with its own motif,
 * chevrons for Wick and diamonds for Bun, so the two strips are told apart at
 * a glance, by dye and by pattern.
 *
 * The curled edges stand about ankle high, enough for the strip to read as
 * something you cannot walk through.
 */
import {
  CanvasTexture,
  Color,
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
  const layersFor = (colours: SeatColours, seat: number): SweptLayer[] => {
    const texture = clothTexture(colours, motifFor(seat));
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
    seats: options.seats.map((colours, seat) => layersFor(colours, seat)),
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

/** Each mummy's own woven motif, so the two strips differ in pattern as well as dye. */
export type LinenMotif = 'chevrons' | 'diamonds';

/** Wick and the Four Way corners that reuse his build wear chevrons; Bun and hers wear diamonds. */
export function motifFor(seat: number): LinenMotif {
  return seat % 2 === 0 ? 'chevrons' : 'diamonds';
}

const LINEN = new Color('#efe3c8');

/**
 * Linen dyed in the mummy's colour: a basket weave, a deep hem along each long edge and the
 * mummy's motif down the middle, outlined in undyed cream so it reads by torchlight. Maps once
 * across a strip (v) and once along each half cell (u). `repeat` tiles it, for a cocoon.
 */
export function clothTexture(colours: SeatColours, motif: LinenMotif, repeat = 1): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the cloth');
  const dyed = LINEN.clone().lerp(new Color(colours.main), 0.72).lerp(new Color(colours.deep), 0.2);
  context.fillStyle = `#${dyed.getHexString()}`;
  context.fillRect(0, 0, size, size);
  weave(context, size);
  // A wide hem at each long edge with a thin stripe inside it.
  context.fillStyle = colours.deep;
  context.fillRect(0, 0, size, 6);
  context.fillRect(0, 12, size, 4);
  context.fillRect(0, size - 16, size, 4);
  context.fillRect(0, size - 6, size, 6);
  context.lineJoin = 'round';
  context.lineWidth = 14;
  context.strokeStyle = '#f4ead4';
  traceMotif(context, motif, size);
  context.stroke();
  context.lineWidth = 7;
  context.strokeStyle = colours.deep;
  traceMotif(context, motif, size);
  context.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

/** Over-and-under threads in small squares, alternately running along and across. */
function weave(context: CanvasRenderingContext2D, size: number): void {
  const cell = 4;
  for (let row = 0; row < size / cell; row++) {
    for (let column = 0; column < size / cell; column++) {
      const x = column * cell;
      const y = row * cell;
      context.fillStyle =
        (row + column) % 2 === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(60, 40, 20, 0.1)';
      if ((row + column) % 2 === 0) context.fillRect(x, y + 1, cell, 2);
      else context.fillRect(x + 1, y, 2, cell);
    }
  }
}

/** The motif's path, centred across the strip; one chevron or diamond to each half cell. */
function traceMotif(context: CanvasRenderingContext2D, motif: LinenMotif, size: number): void {
  const middle = size / 2;
  context.beginPath();
  if (motif === 'chevrons') {
    context.moveTo(middle - 22, middle - 26);
    context.lineTo(middle + 14, middle);
    context.lineTo(middle - 22, middle + 26);
    return;
  }
  context.moveTo(middle, middle - 24);
  context.lineTo(middle + 24, middle);
  context.lineTo(middle, middle + 24);
  context.lineTo(middle - 24, middle);
  context.closePath();
}
