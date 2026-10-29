/**
 * Ice Trail's walls: each skater freezes a ridge of ice behind them as they
 * go, one continuous glassy ramp that sweeps round the corners the way the
 * skater did, in the manner of every ice-powered hero's slide. A core of the
 * skater's colour glows inside the clear ice, and a band of frost powder lies
 * along its foot. The two ridges differ in build as well as colour: Juniper's
 * has a crest of small jagged crystals, Sorrel's a smooth rounded crest.
 */
import {
  ConeGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Color,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeatColours } from '../../look/look.ts';
import { alongPath, boxSection, sweepSection } from '../../look/sweep.ts';
import { createSweptTrail, type SweptLayer, type SweptTrail } from '../../look/swept-trail.ts';

export const ICE_TOP = 0.02;
const RIDGE_TOP = 0.48;

/** Across the ridge from its left foot over the crest to its right foot, a little faceted. */
const RIDGE_SECTION = [
  [-0.36, 0.02],
  [-0.31, 0.12],
  [-0.22, 0.3],
  [-0.1, RIDGE_TOP - 0.02],
  [0, RIDGE_TOP],
  [0.1, RIDGE_TOP - 0.02],
  [0.22, 0.3],
  [0.31, 0.12],
  [0.36, 0.02],
].map(([offset = 0, height = 0]) => new Vector2(offset, height + ICE_TOP));

export function createIceWalls(options: {
  readonly seats: readonly SeatColours[];
  readonly night: boolean;
}): SweptTrail {
  const { night } = options;
  const materials: Material[] = [];
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  // Clear ice with a cast of the skater's colour, so the ridge itself says whose it is.
  const iceFor = (colours: SeatColours) =>
    own(
      new MeshPhysicalMaterial({
        // By day the deep shade, so orange and blue stay far apart on pale ice and snow.
        color: night
          ? new Color('#b9dcff').lerp(new Color(colours.main), 0.55)
          : new Color(colours.deep),
        // By day a softer sheen, so the sun does not wash the colour off the crest.
        roughness: night ? 0.05 : 0.3,
        metalness: 0,
        clearcoat: night ? 1 : 0.25,
        clearcoatRoughness: night ? 0.04 : 0.3,
        transparent: true,
        opacity: night ? 0.55 : 0.88,
        flatShading: true,
        side: DoubleSide,
      }),
    );
  const frost = own(
    new MeshStandardMaterial({
      color: night ? '#d6e6ff' : '#ffffff',
      roughness: 1,
      transparent: true,
      opacity: 0.45,
    }),
  );

  const layersFor = (colours: SeatColours, crested: boolean): SweptLayer[] => {
    const ice = iceFor(colours);
    const core = own(
      new MeshBasicMaterial({
        color: night ? new Color(colours.main).multiplyScalar(2.2) : new Color(colours.deep),
        side: DoubleSide,
      }),
    );
    const layers: SweptLayer[] = [
      {
        build: (path) => sweepSection(path, boxSection(0, 0.5, ICE_TOP, ICE_TOP + 0.012)),
        material: frost,
        receiveShadow: true,
      },
      {
        build: (path) => sweepSection(path, boxSection(0, 0.18, ICE_TOP, ICE_TOP + 0.34)),
        material: core,
      },
      { build: (path) => sweepSection(path, RIDGE_SECTION), material: ice, castShadow: true },
    ];
    if (crested) layers.push({ build: crestAlong, material: ice, castShadow: true });
    return layers;
  };
  const trail = createSweptTrail({
    // Crest crystals mark every other rider, so neighbours in colour differ in shape too.
    seats: options.seats.map((colours, seat) => layersFor(colours, seat % 2 === 0)),
  });
  return {
    ...trail,
    dispose() {
      trail.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** Juniper's crest: small crystals standing up along the top of the ridge, leaning this way and that. */
function crestAlong(path: readonly Vector2[]): BufferGeometry {
  const crystals = alongPath(path, 0.17).map(({ point }, index) => {
    const height = 0.14 + (index % 3) * 0.05;
    const crystal = new ConeGeometry(0.05, height, 5);
    crystal.translate(0, height / 2, 0);
    crystal.rotateZ(((index % 5) - 2) * 0.12);
    crystal.translate(point.x, ICE_TOP + RIDGE_TOP - 0.04, point.y);
    return crystal;
  });
  return mergeGeometries(crystals);
}
