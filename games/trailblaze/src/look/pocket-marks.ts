/**
 * The trap's pocket, marked on the floor: every cell the trapped rider can
 * still reach gets a rounded outline round a soft fill, pulsing for a moment
 * when the trap closes and then holding steady. Each look picks the colour
 * and whether the marks glow (added light, for night scenes) or are painted
 * on (blended, for day scenes and pale floors).
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  type ColorRepresentation,
} from 'three';
import type { Cell } from '../engine/types.ts';
import { cellCentre } from './board-space.ts';

/** More than any pocket the trap moment is shown for. */
const CAPACITY = 120;
const PULSE_SECONDS = 2;

export interface PocketMarks {
  readonly mesh: InstancedMesh;
  show(cells: readonly Cell[], colour: ColorRepresentation): void;
  hide(): void;
  update(dt: number): void;
  dispose(): void;
}

export function createPocketMarks(options: {
  /** Height of the floor the marks lie on. */
  readonly floor: number;
  readonly glow: boolean;
  /** Steady opacity once the pulse is over. */
  readonly strength: number;
}): PocketMarks {
  const geometry = new PlaneGeometry(0.92, 0.92);
  geometry.rotateX(-Math.PI / 2);
  const texture = markTexture();
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: options.glow ? AdditiveBlending : NormalBlending,
  });
  const mesh = new InstancedMesh(geometry, material, CAPACITY);
  mesh.count = 0;
  mesh.frustumCulled = false;
  const matrix = new Matrix4();
  let age = Infinity;

  return {
    mesh,
    show(cells, colour) {
      material.color = new Color(colour);
      mesh.count = Math.min(cells.length, CAPACITY);
      cells.slice(0, CAPACITY).forEach((cell, index) => {
        mesh.setMatrixAt(index, matrix.makeTranslation(cellCentre(cell, options.floor + 0.004)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      age = 0;
    },
    hide() {
      mesh.count = 0;
      age = Infinity;
    },
    update(dt) {
      age += dt;
      const fadeIn = Math.min(1, age * 5);
      const pulse = age < PULSE_SECONDS ? 0.3 * Math.sin(age * 10) * (1 - age / PULSE_SECONDS) : 0;
      material.opacity = Number.isFinite(age) ? options.strength * (1 + pulse) * fadeIn : 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      mesh.dispose();
    },
  };
}

function markTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the pocket mark');
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.beginPath();
  context.roundRect(6, 6, 52, 52, 9);
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 5;
  context.stroke();
  return new CanvasTexture(canvas);
}
