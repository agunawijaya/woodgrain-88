/**
 * Toy Trains' track, laid by each locomotive as it goes: a painted wooden
 * bed in the engine's colour, dark sleepers across it and two steel rails on
 * top. Both engines lay the same kind of track. Where a track turns a right
 * angle, bed, sleepers and rails sweep round the same curve the engine runs
 * along. The bed stands proud of the mat, so a trail reads as a barrier at a
 * glance.
 */
import {
  DoubleSide,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
  type Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeatColours } from '../../look/look.ts';
import { alongPath, boxSection, straightPath, sweepSection } from '../../look/sweep.ts';
import { createSweptTrail, type SweptLayer, type SweptTrail } from '../../look/swept-trail.ts';

/** Height of the play mat's top; the track sits on it. */
export const MAT_TOP = 0.03;
export const BED_HEIGHT = 0.1;
const BED_TOP = MAT_TOP + BED_HEIGHT;
const BED_WIDTH = 0.5;
const SLEEPER_LENGTH = 0.66;
const SLEEPER_SPACING = 0.25;
const SLEEPER_TOP = BED_TOP + 0.035;
const RAIL_GAUGE = 0.3;
const RAIL_WIDTH = 0.045;
const RAIL_TOP = SLEEPER_TOP + 0.05;

export function createTrack(options: { readonly seats: readonly SeatColours[] }): SweptTrail {
  const materials: Material[] = [];
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const wood = own(
    new MeshStandardMaterial({ color: '#6b4a30', roughness: 0.75, side: DoubleSide }),
  );
  const steel = own(
    new MeshStandardMaterial({
      color: '#cfd4dc',
      roughness: 0.25,
      metalness: 0.9,
      side: DoubleSide,
    }),
  );

  const bedFor = (colours: SeatColours) =>
    own(new MeshStandardMaterial({ color: colours.main, roughness: 0.5, side: DoubleSide }));
  const layersFor = (bed: Material): SweptLayer[] => [
    {
      build: (path) => sweepSection(path, boxSection(0, BED_WIDTH, MAT_TOP, BED_TOP)),
      material: bed,
      castShadow: true,
      receiveShadow: true,
    },
    // Sleepers click into place once the engine has passed; the growing tail is bed and rails.
    { build: sleepersAlong, material: wood, castShadow: true, onTail: false },
    { build: railsAlong, material: steel },
  ];
  const trail = createSweptTrail({
    seats: options.seats.map((colours) => layersFor(bedFor(colours))),
  });
  return {
    ...trail,
    dispose() {
      trail.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

function sleepersAlong(path: readonly Vector2[]): BufferGeometry {
  const pieces = alongPath(path, SLEEPER_SPACING).map(({ point, angle }) => {
    const sleeper = sweepSection(
      straightPath(-0.045, 0.045),
      boxSection(0, SLEEPER_LENGTH, BED_TOP, SLEEPER_TOP),
    );
    sleeper.rotateY(-angle);
    sleeper.translate(point.x, 0, point.y);
    return sleeper;
  });
  return mergeGeometries(pieces);
}

function railsAlong(path: readonly Vector2[]): BufferGeometry {
  return mergeGeometries(
    [-RAIL_GAUGE / 2, RAIL_GAUGE / 2].map((offset) =>
      sweepSection(path, boxSection(offset, RAIL_WIDTH, SLEEPER_TOP, RAIL_TOP)),
    ),
  );
}
