/**
 * A Tabletop explorer: a turned wooden pawn lacquered in its team's colour,
 * with a brass foot ring and a little pith helmet on its head. Pawns do not
 * walk; they hop from tile to tile the way a hand moves them, and squash a
 * touch when they land.
 */
import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import type { SeatColours } from '../../look/look.ts';

export interface Pawn {
  readonly root: Group;
  /** Squash on landing (1) relaxing back to 0. */
  land(amount: number): void;
  update(dt: number): void;
  dispose(): void;
}

export function createPawn(colours: SeatColours): Pawn {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const root = new Group();
  root.name = 'pawn';
  root.scale.setScalar(1.22);
  const body = new Group();
  root.add(body);

  const lacquer = own(
    new MeshPhysicalMaterial({
      color: colours.main,
      roughness: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    }),
  );
  const turned = new Mesh(
    keep(
      new LatheGeometry(
        [
          new Vector2(0, 0),
          new Vector2(0.86, 0),
          new Vector2(0.92, 0.08),
          new Vector2(0.9, 0.22),
          new Vector2(0.7, 0.32),
          new Vector2(0.48, 0.55),
          new Vector2(0.36, 0.95),
          new Vector2(0.33, 1.18),
          new Vector2(0.6, 1.26),
          new Vector2(0.62, 1.34),
          new Vector2(0.36, 1.42),
          new Vector2(0.28, 1.52),
          new Vector2(0, 1.52),
        ],
        36,
      ),
    ),
    lacquer,
  );
  turned.castShadow = true;
  turned.receiveShadow = true;
  body.add(turned);

  const head = new Mesh(keep(new SphereGeometry(0.52, 28, 20)), lacquer);
  head.position.y = 1.95;
  head.castShadow = true;
  body.add(head);

  const brass = own(new MeshStandardMaterial({ color: '#d4a53c', metalness: 1, roughness: 0.3 }));
  const footRing = new Mesh(keep(new TorusGeometry(0.88, 0.06, 8, 36)), brass);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = 0.16;
  body.add(footRing);

  // The pith helmet: a khaki dome with a wide brim and a band in the team's deeper shade.
  const khaki = own(new MeshStandardMaterial({ color: '#d9c79a', roughness: 0.7 }));
  const helmet = new Mesh(
    keep(new SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
    khaki,
  );
  helmet.position.y = 2.22;
  helmet.scale.set(1, 0.85, 1.08);
  helmet.castShadow = true;
  const brim = new Mesh(keep(new CylinderGeometry(0.82, 0.86, 0.06, 32)), khaki);
  brim.position.y = 2.22;
  brim.scale.set(1, 1, 1.12);
  brim.castShadow = true;
  const band = new Mesh(
    keep(new CylinderGeometry(0.5, 0.5, 0.12, 28, 1, true)),
    own(new MeshStandardMaterial({ color: colours.deep, roughness: 0.6 })),
  );
  band.position.y = 2.3;
  band.scale.set(1, 1, 1.08);
  const button = new Mesh(keep(new SphereGeometry(0.07, 10, 8)), brass);
  button.position.y = 2.65;
  body.add(helmet, brim, band, button);

  let squash = 0;
  return {
    root,
    land(amount) {
      squash = Math.max(squash, amount);
    },
    update(dt) {
      squash = Math.max(0, squash - dt * 5);
      const wobble = squash * Math.cos((1 - squash) * 14);
      body.scale.set(1 + wobble * 0.12, 1 - wobble * 0.16, 1 + wobble * 0.12);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
