/**
 * Confetti for a capture: small paper squares thrown up from the flag that
 * flutter down, tumbling and catching the light. Lit like everything else
 * (not glowing), so it reads by day and is lit by lanterns and flares by
 * night. One instanced mesh, simulated on the CPU, deterministic by seed.
 */
import type { Rng } from '@woodgrain-88/kit';
import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';

export interface Confetti {
  readonly mesh: InstancedMesh;
  burst(at: Vector3, colours: readonly string[], rng: Rng): void;
  update(dt: number): void;
  dispose(): void;
}

const PIECES = 140;
const GRAVITY = 7;
/** Paper falls slowly once it is spread out. */
const TERMINAL_SPEED = 1.6;

interface Piece {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly axis: Vector3;
  angle: number;
  spin: number;
  age: number;
  life: number;
}

export function createConfetti(size = 0.22): Confetti {
  const geometry = new PlaneGeometry(size, size * 0.6);
  const material = new MeshStandardMaterial({ roughness: 0.6, side: DoubleSide });
  const mesh = new InstancedMesh(geometry, material, PIECES);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  const pieces: Piece[] = [];
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const unit = new Vector3(1, 1, 1);
  const hidden = new Vector3(0, 0, 0);

  return {
    mesh,
    burst(at, colours, rng) {
      pieces.length = 0;
      for (let index = 0; index < PIECES; index++) {
        const angle = rng.float(0, Math.PI * 2);
        const speed = rng.float(1.2, 4.5);
        pieces.push({
          position: at.clone().add(new Vector3(0, rng.float(0.5, 2.5), 0)),
          velocity: new Vector3(Math.cos(angle) * speed, rng.float(5, 10), Math.sin(angle) * speed),
          axis: new Vector3(rng.float(-1, 1), rng.float(-1, 1), rng.float(-1, 1)).normalize(),
          angle: rng.float(0, Math.PI * 2),
          spin: rng.float(6, 14),
          age: 0,
          life: rng.float(3.5, 5.5),
        });
        mesh.setColorAt(index, new Color(colours[index % colours.length] ?? '#ffffff'));
      }
      mesh.count = PIECES;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    update(dt) {
      pieces.forEach((piece, index) => {
        piece.age += dt;
        if (piece.position.y > 0.05) {
          piece.velocity.y = Math.max(-TERMINAL_SPEED, piece.velocity.y - GRAVITY * dt);
          piece.velocity.x *= 1 - Math.min(1, dt * 1.2);
          piece.velocity.z *= 1 - Math.min(1, dt * 1.2);
          piece.position.addScaledVector(piece.velocity, dt);
          piece.angle += piece.spin * dt;
        } else {
          piece.position.y = 0.04;
        }
        const alive = piece.age < piece.life;
        turn.setFromAxisAngle(piece.axis, piece.angle);
        matrix.compose(piece.position, turn, alive ? unit : hidden);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
