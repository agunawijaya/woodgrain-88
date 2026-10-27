/**
 * Shared modelling helpers for the duel's miniatures: profiles extruded into
 * chamfered solids, the painted-miniature materials and the small finishing
 * touches (dust on the lower panels, uneven paint) that make a model read as
 * a hand-painted figure on a table instead of a plastic toy.
 */
import {
  Color,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Shape,
  Vector2,
  type BufferGeometry,
  type ColorRepresentation,
} from 'three';

/** A closed outline in a plane, as [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[];

function shapeOf(outline: Outline): Shape {
  return new Shape(outline.map(([x, y]) => new Vector2(x, y)));
}

/**
 * A side profile (x forward, y up) extruded across the model's width (z), centred on z = 0, with
 * chamfered edges so light picks out every panel line.
 */
export function profileSolid(outline: Outline, width: number, bevel: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shapeOf(outline), {
    depth: Math.max(0.001, width - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -(width - bevel * 2) / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A plan outline (x forward, y towards the model's left) raised `height` upwards from y = 0, with
 * chamfers. Used for turrets, hatches and anything drawn from above.
 */
export function planSolid(outline: Outline, height: number, bevel: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shapeOf(outline), {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  });
  // Extrusion runs along +z; stand it up so the plan lies flat and the height goes up.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** Narrows a solid towards its top: sloped armour on turrets and superstructures. */
export function taperTop(
  geometry: BufferGeometry,
  bottom: number,
  top: number,
  factor: number,
): void {
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    const t = Math.min(1, Math.max(0, (y - bottom) / (top - bottom)));
    const squeeze = 1 - (1 - factor) * t;
    positions.setX(index, positions.getX(index) * squeeze);
    positions.setZ(index, positions.getZ(index) * squeeze);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

export interface PaintOptions {
  readonly roughness?: number;
  readonly metalness?: number;
  /** Dust gathered on the lower panels, strongest at the base, in local units; 0 for none. */
  readonly dustHeight?: number;
  readonly dust?: ColorRepresentation;
  /** How uneven the paint is, 0–1. */
  readonly mottle?: number;
}

/**
 * Satin miniature paint. The shader adds a soft mottle and a layer of dust on the lower parts, both
 * in the model's own space so they ride along as it drives and turns.
 */
export function paintMaterial(
  colour: ColorRepresentation,
  options: PaintOptions = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: colour,
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.04,
  });
  const dustColour = new Color(options.dust ?? '#b59a72');
  const dustHeight = options.dustHeight ?? 0.55;
  const mottle = options.mottle ?? 0.5;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.dustColour = { value: dustColour };
    shader.uniforms.dustHeight = { value: dustHeight };
    shader.uniforms.mottle = { value: mottle };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vModelPosition;\nvarying float vPaintUp;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvPaintUp = normalize(mat3(modelMatrix) * objectNormal).y;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvModelPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vModelPosition;',
          'varying float vPaintUp;',
          'uniform vec3 dustColour;',
          'uniform float dustHeight;',
          'uniform float mottle;',
          'float paintHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
          'float paintNoise(vec3 x) {',
          '  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
          '  return mix(mix(mix(paintHash(i), paintHash(i + vec3(1,0,0)), f.x), mix(paintHash(i + vec3(0,1,0)), paintHash(i + vec3(1,1,0)), f.x), f.y),',
          '             mix(mix(paintHash(i + vec3(0,0,1)), paintHash(i + vec3(1,0,1)), f.x), mix(paintHash(i + vec3(0,1,1)), paintHash(i + vec3(1,1,1)), f.x), f.y), f.z);',
          '}',
        ].join('\n'),
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'float blotch = paintNoise(vModelPosition * 3.1) * 0.65 + paintNoise(vModelPosition * 9.0) * 0.35;',
          'diffuseColor.rgb *= 1.0 + (blotch - 0.5) * 0.22 * mottle;',
          // No dust at all is asked for explicitly: smoothstep with its edges the wrong way round is
          // undefined, and on some drivers it painted every aircraft half in dust.
          'float dusty = dustHeight > 0.0 ? 1.0 - smoothstep(0.0, dustHeight, vModelPosition.y + (paintNoise(vModelPosition * 6.0) - 0.5) * 0.18) : 0.0;',
          'diffuseColor.rgb = mix(diffuseColor.rgb, dustColour, dusty * 0.55);',
          // Drybrushing: a miniature painter catches every chamfer with a lighter tone, and the
          // upward faces fade a little in the sun.
          'float chamfer = smoothstep(0.3, 0.6, vPaintUp) * (1.0 - smoothstep(0.78, 0.96, vPaintUp));',
          'diffuseColor.rgb *= 1.0 + chamfer * 0.45 + smoothstep(0.92, 1.0, vPaintUp) * 0.07;',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'miniature-paint';
  return material;
}

export function steelMaterial(colour: ColorRepresentation = '#4a4743'): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: colour, roughness: 0.42, metalness: 0.7 });
}

export function rubberMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#2a2724', roughness: 0.85, metalness: 0 });
}

/** A lens or lamp that glows: dim by day, bright enough to bloom at night. */
export function lampMaterial(colour: ColorRepresentation): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: '#fff6e0',
    emissive: colour,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0,
  });
}
