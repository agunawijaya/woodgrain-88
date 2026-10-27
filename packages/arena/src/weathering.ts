/**
 * Weathering for terrain pieces. A crafted wargame board is never one flat
 * colour: grime gathers where walls meet the ground, the painter drybrushes
 * every top edge a shade lighter, and no two blocks came out of the mould the
 * same tone. All three are done in the shader from world position and normal,
 * so one material serves a whole wall of pieces, instanced or not.
 */
import { Color, type ColorRepresentation, type MeshStandardMaterial } from 'three';

export interface WeatherOptions {
  /** Colour of the dirt at the foot of a piece. */
  readonly grime?: ColorRepresentation;
  /** How high the grime reaches, in world units. */
  readonly grimeHeight?: number;
  /** Brightening of upward-facing chamfers, 0–1. */
  readonly edgeLight?: number;
  /** How much one piece's tone may differ from the next, 0–1. */
  readonly variation?: number;
}

export function weatherMaterial(
  material: MeshStandardMaterial,
  options: WeatherOptions = {},
): void {
  const grime = new Color(options.grime ?? '#6e5a40');
  const grimeHeight = options.grimeHeight ?? 0.6;
  const edgeLight = options.edgeLight ?? 0.3;
  const variation = options.variation ?? 0.12;
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.weatherGrime = { value: grime };
    shader.uniforms.weatherGrimeHeight = { value: grimeHeight };
    shader.uniforms.weatherEdgeLight = { value: edgeLight };
    shader.uniforms.weatherVariation = { value: variation };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWeatherWorld;\nvarying float vWeatherUp;\nvarying float vWeatherSeed;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        [
          '#include <beginnormal_vertex>',
          'mat4 weatherModel = modelMatrix;',
          '#ifdef USE_INSTANCING',
          'weatherModel = modelMatrix * instanceMatrix;',
          '#endif',
          'vWeatherUp = normalize(mat3(weatherModel) * objectNormal).y;',
          'vWeatherSeed = fract(sin(dot(weatherModel[3].xz, vec2(12.9898, 78.233))) * 43758.5453);',
        ].join('\n'),
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWeatherWorld = (weatherModel * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vWeatherWorld;',
          'varying float vWeatherUp;',
          'varying float vWeatherSeed;',
          'uniform vec3 weatherGrime;',
          'uniform float weatherGrimeHeight;',
          'uniform float weatherEdgeLight;',
          'uniform float weatherVariation;',
        ].join('\n'),
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'diffuseColor.rgb *= 1.0 + (vWeatherSeed - 0.5) * 2.0 * weatherVariation;',
          'float weatherLow = 1.0 - smoothstep(0.0, weatherGrimeHeight, vWeatherWorld.y);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * weatherGrime * 1.6, weatherLow * 0.65);',
          'float weatherChamfer = smoothstep(0.3, 0.6, vWeatherUp) * (1.0 - smoothstep(0.8, 0.97, vWeatherUp));',
          'diffuseColor.rgb *= 1.0 + weatherChamfer * weatherEdgeLight;',
        ].join('\n'),
      );
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|weathered`;
  material.needsUpdate = true;
}
