/**
 * What digging a square turns up in the Polar Expedition: an ice slab with a
 * carved numeral glowing hot or cold, a painted marker arrow planted on two
 * pegs, the crater a bomb leaves, and the flag itself. Numeral textures are
 * drawn once per view and shared by every slab with the same number.
 */
import type { Rng } from '@woodgrain-88/kit';
import {
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type CanvasTexture,
  type IUniform,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bearingDegrees, type Bearing } from '../../engine/grid.ts';
import { bearingYaw } from '../../look/field-space.ts';
import { createGlyphTexture, DISPLAY_FONT } from '../../look/glyphs.ts';
import { heat, heatColour, MAX_DISTANCE, type HeatPalette } from '../../look/heat.ts';

export interface CluePieces {
  numeral(distance: number): Group;
  arrow(bearing: Bearing): Group;
  crater(rng: Rng): Group;
  flag(): PolarFlag;
  update(dt: number): void;
  dispose(): void;
}

export interface PolarFlag {
  readonly root: Group;
  /** 0 buried, 1 fully risen and unfurled; the view eases it along. */
  setRise(amount: number): void;
  update(dt: number): void;
}

const SLAB_SIZE = 3.0;

export function createCluePieces(night: boolean, palette: HeatPalette): CluePieces {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: CanvasTexture[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const wave: IUniform<number> = { value: 0 };

  const slabGeometry = keep(new RoundedBoxGeometry(SLAB_SIZE, 0.34, SLAB_SIZE, 3, 0.14));
  const numeralGeometry = keep(new PlaneGeometry(SLAB_SIZE * 0.86, SLAB_SIZE * 0.86));
  numeralGeometry.rotateX(-Math.PI / 2);

  const numeralMaterials = new Map<
    number,
    { slab: MeshStandardMaterial; glyph: MeshStandardMaterial }
  >();
  const numeralFor = (distance: number) => {
    const cached = numeralMaterials.get(distance);
    if (cached) return cached;
    const hot = new Color(heatColour(distance, palette));
    const warmth = heat(distance);
    const carved = createGlyphTexture(String(distance), {
      font: `800 ${DISPLAY_FONT}`,
      scale: 0.86,
      size: 256,
      colour: true,
      paint(context, text) {
        // The groove's walls in shadow, then the glowing fill inside them.
        context.lineJoin = 'round';
        context.strokeStyle = 'rgba(16, 38, 60, 0.9)';
        context.lineWidth = 30;
        context.strokeText(text, 0, 8);
        context.fillStyle = `#${hot.getHexString()}`;
        context.fillText(text, 0, 8);
      },
    });
    const glow = createGlyphTexture(String(distance), {
      font: `800 ${DISPLAY_FONT}`,
      scale: 0.86,
      size: 256,
      colour: false,
      paint(context, text) {
        context.fillStyle = '#ffffff';
        context.fillText(text, 0, 8);
      },
    });
    textures.push(carved, glow);
    const slab = own(
      new MeshStandardMaterial({
        color: night ? '#4d82b0' : '#5c97c9',
        roughness: 0.16,
        metalness: 0,
        envMapIntensity: 1.2,
        emissive: hot.clone().lerp(new Color('#7fc4ff'), 0.5),
        emissiveIntensity: night ? 0.05 + warmth * 0.08 : 0,
      }),
    );
    const glyph = own(
      new MeshStandardMaterial({
        map: carved,
        transparent: true,
        depthWrite: false,
        roughness: 0.3,
        emissive: hot,
        emissiveMap: glow,
        emissiveIntensity: night ? 1.1 + warmth * 1.4 : 0.35 + warmth * 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    const materialsFor = { slab, glyph };
    numeralMaterials.set(distance, materialsFor);
    return materialsFor;
  };

  const arrowShape = arrowOutline(2.7, 0.62, 1.55, 1.05);
  const arrowGeometry = keep(
    new ExtrudeGeometry(arrowShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    }),
  );
  arrowGeometry.rotateX(-Math.PI / 2);
  const stripeGeometry = keep(
    new ExtrudeGeometry(arrowOutline(1.9, 0.24, 0.92, 0.66), { depth: 0.04, bevelEnabled: false }),
  );
  stripeGeometry.rotateX(-Math.PI / 2);
  const arrowWood = own(new MeshStandardMaterial({ color: '#25344f', roughness: 0.55 }));
  const arrowStripe = own(
    new MeshStandardMaterial({
      color: '#ffd23f',
      roughness: 0.35,
      emissive: new Color('#ffc21a'),
      emissiveIntensity: night ? 1.1 : 0,
    }),
  );
  const pegGeometry = keep(new CylinderGeometry(0.09, 0.11, 0.5, 8));
  const pegMaterial = own(new MeshStandardMaterial({ color: '#8a6038', roughness: 0.75 }));

  const lumpGeometry = keep(new DodecahedronGeometry(0.32, 1));
  const lumpMaterial = own(
    new MeshStandardMaterial({ color: night ? '#dfe8f6' : '#f6faff', roughness: 0.9 }),
  );
  const shardMaterial = own(
    new MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.6, flatShading: true }),
  );

  const flagPoleGeometry = keep(new CylinderGeometry(0.06, 0.07, 3.6, 10));
  const finialGeometry = keep(new SphereGeometry(0.16, 14, 10));
  const clothGeometry = keep(new PlaneGeometry(1.9, 1.2, 20, 10));
  clothGeometry.translate(0.95, 0, 0);
  const poleMaterial = own(
    new MeshStandardMaterial({ color: '#c9ced6', roughness: 0.3, metalness: 0.8 }),
  );
  const goldMaterial = own(
    new MeshStandardMaterial({
      color: '#f2c14e',
      roughness: 0.25,
      metalness: 0.9,
      emissive: new Color('#ffb020'),
      emissiveIntensity: night ? 0.8 : 0.1,
    }),
  );
  const clothMaterial = own(flagCloth(wave, night));

  return {
    numeral(distance) {
      const clamped = Math.min(MAX_DISTANCE, Math.max(1, distance));
      const { slab, glyph } = numeralFor(clamped);
      const group = new Group();
      const ice = new Mesh(slabGeometry, slab);
      ice.position.y = 0.06;
      ice.receiveShadow = true;
      ice.castShadow = true;
      const carving = new Mesh(numeralGeometry, glyph);
      carving.position.y = 0.24;
      group.add(ice, carving);
      return group;
    },
    arrow(bearing) {
      const group = new Group();
      const marker = new Group();
      const board = new Mesh(arrowGeometry, arrowWood);
      board.castShadow = true;
      board.receiveShadow = true;
      const stripe = new Mesh(stripeGeometry, arrowStripe);
      stripe.position.y = 0.22;
      stripe.position.z = -0.12;
      marker.add(board, stripe);
      marker.position.y = 0.38;
      // Planted nose-up a touch, as if pushed into the snow at the tail.
      marker.rotation.x = 0.07;
      for (const along of [0.85, -0.55]) {
        const peg = new Mesh(pegGeometry, pegMaterial);
        peg.position.set(0, 0.16, along);
        peg.castShadow = true;
        group.add(peg);
      }
      group.add(marker);
      group.rotation.y = bearingYaw(bearingDegrees(bearing));
      return group;
    },
    crater(rng) {
      const group = new Group();
      const lumps = new InstancedMesh(lumpGeometry, lumpMaterial, 14);
      const shards = new InstancedMesh(lumpGeometry, shardMaterial, 6);
      lumps.castShadow = true;
      lumps.receiveShadow = true;
      shards.castShadow = true;
      const matrix = new Matrix4();
      const spin = new Quaternion();
      for (let index = 0; index < 14; index++) {
        const angle = (index / 14) * Math.PI * 2 + rng.float(-0.2, 0.2);
        const reach = rng.float(1.25, 1.75);
        const size = rng.float(0.6, 1.3);
        spin.setFromAxisAngle(
          new Vector3(rng.float(-1, 1), 1, rng.float(-1, 1)).normalize(),
          rng.float(0, 6),
        );
        matrix.compose(
          new Vector3(Math.cos(angle) * reach, 0.08 * size, Math.sin(angle) * reach),
          spin,
          new Vector3(size, size * 0.6, size),
        );
        lumps.setMatrixAt(index, matrix);
      }
      for (let index = 0; index < 6; index++) {
        const angle = rng.float(0, Math.PI * 2);
        const reach = rng.float(0.2, 1.1);
        const size = rng.float(0.25, 0.5);
        spin.setFromAxisAngle(
          new Vector3(rng.float(-1, 1), 1, rng.float(-1, 1)).normalize(),
          rng.float(0, 6),
        );
        matrix.compose(
          new Vector3(Math.cos(angle) * reach, 0.04, Math.sin(angle) * reach),
          spin,
          new Vector3(size, size * 0.45, size * 0.8),
        );
        shards.setMatrixAt(index, matrix);
      }
      group.add(lumps, shards);
      return group;
    },
    flag() {
      const root = new Group();
      root.scale.setScalar(1.6);
      const mast = new Group();
      const pole = new Mesh(flagPoleGeometry, poleMaterial);
      pole.position.y = 1.8;
      pole.castShadow = true;
      const finial = new Mesh(finialGeometry, goldMaterial);
      finial.position.y = 3.65;
      const cloth = new Mesh(clothGeometry, clothMaterial);
      cloth.position.set(0.04, 2.95, 0);
      cloth.castShadow = true;
      mast.add(pole, finial, cloth);
      root.add(mast);
      let rise = 0;
      const place = () => {
        // Bursts up with a little overshoot, then the cloth unrolls from the pole.
        const up = Math.min(1, rise / 0.55);
        const overshoot = up < 1 ? 1 - Math.pow(1 - up, 3) * Math.cos(up * 7) : 1;
        mast.position.y = -3.7 + 3.7 * overshoot;
        const unfurl = Math.max(0, Math.min(1, (rise - 0.45) / 0.55));
        cloth.scale.set(Math.max(0.02, 1 - Math.pow(1 - unfurl, 3)), Math.max(0.15, unfurl), 1);
      };
      place();
      return {
        root,
        setRise(amount) {
          rise = Math.max(0, Math.min(1, amount));
          place();
        },
        update() {
          place();
        },
      };
    },
    update(dt) {
      wave.value += dt;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

/** A bold arrow pointing north (+y in the shape's plane, which becomes −z once laid flat). */
function arrowOutline(
  length: number,
  shaftWidth: number,
  headWidth: number,
  headLength: number,
): Shape {
  const tail = -length / 2;
  const neck = length / 2 - headLength;
  const tip = length / 2;
  const shape = new Shape();
  shape.moveTo(-shaftWidth / 2, tail);
  shape.lineTo(shaftWidth / 2, tail);
  shape.lineTo(shaftWidth / 2, neck);
  shape.lineTo(headWidth / 2, neck);
  shape.lineTo(0, tip);
  shape.lineTo(-headWidth / 2, neck);
  shape.lineTo(-shaftWidth / 2, neck);
  shape.closePath();
  return shape;
}

/**
 * The flag's cloth: a deep red with a white compass star, rippling from the pole outward. The wave
 * is in the vertex shader so a still frame and a moving one use the same cloth.
 */
function flagCloth(wave: IUniform<number>, night: boolean): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: '#d3203a',
    roughness: 0.7,
    side: DoubleSide,
    emissive: new Color('#ff2a3c'),
    emissiveIntensity: night ? 0.35 : 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.wave = wave;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float wave;\nvarying vec2 vCloth;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float fromPole = clamp(position.x / 1.9, 0.0, 1.0);',
          'transformed.z += sin(position.x * 3.2 - wave * 7.0) * 0.16 * fromPole;',
          'transformed.y -= fromPole * fromPole * 0.12;',
          'vCloth = vec2(fromPole, position.y / 1.2 + 0.5);',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloth;')
      .replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          // A four-pointed white star in the hoist half, and a gold edge on the fly.
          'vec2 starAt = (vCloth - vec2(0.36, 0.5)) * vec2(1.9, 1.2);',
          'float spike = abs(starAt.x) * abs(starAt.y) * 26.0 + length(starAt) * 2.6;',
          'float star = 1.0 - smoothstep(0.55, 0.62, spike);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), star);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.72, 0.25), smoothstep(0.93, 0.95, vCloth.x));',
        ].join('\n'),
      );
  };
  return material;
}
