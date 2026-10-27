/**
 * Two lighting rigs for one table. By day the board sits under a high sun
 * with a sky-blue fill, so shadows are crisp and the paint reads true. By
 * night a single warm desk lamp pools light over the board while a cool
 * moonlight fill keeps the far corners readable; muzzle flashes and
 * explosions light everything around them, which is most of the night look.
 *
 * A game can set its own mood over these defaults: a colder sun for a
 * snowfield, or a night lit by the moon alone, with the moon casting the
 * shadows instead of the lamp.
 */
import type { Appearance } from '@woodgrain-88/kit';
import type { Object3D } from 'three';
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
  SpotLight,
  Vector3,
  type ColorRepresentation,
} from 'three';

export interface LightRigOptions {
  /** Half the width (x) and depth (z) of the area that must receive shadows. */
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly shadowMapSize: number;
  readonly mood?: LightMood;
}

export interface DayMood {
  readonly sun: ColorRepresentation;
  readonly sunIntensity: number;
  readonly sky: ColorRepresentation;
  readonly ground: ColorRepresentation;
  readonly hemiIntensity: number;
}

export interface NightMood {
  readonly lamp: ColorRepresentation;
  /** 0 turns the lamp off. */
  readonly lampIntensity: number;
  /** The lamp's cone half-angle in radians, and how soft its edge is (0 hard to 1 soft). */
  readonly lampAngle: number;
  readonly lampPenumbra: number;
  readonly moon: ColorRepresentation;
  readonly moonIntensity: number;
  readonly sky: ColorRepresentation;
  readonly ground: ColorRepresentation;
  readonly hemiIntensity: number;
  /** Which light casts the night's shadows: the desk lamp (default) or the moon. */
  readonly shadowsFrom: 'lamp' | 'moon';
}

/** A game's own light over the defaults; anything left out keeps the default. */
export interface LightMood {
  readonly day?: Partial<DayMood>;
  readonly night?: Partial<NightMood>;
}

/** The colours effects need to light themselves like the scene (smoke, clouds, dust). */
export interface LightPalette {
  /** Unit vector from the table towards the key light. */
  readonly keyDirection: Vector3;
  readonly key: Color;
  readonly ambient: Color;
}

export interface LightRig {
  readonly group: Group;
  readonly appearance: Appearance;
  readonly palette: LightPalette;
  setAppearance(appearance: Appearance): void;
  /**
   * Moves the sun (and the moon opposite it): azimuth in degrees round the table from the back, elevation
   * above it. Aircraft channels want a high sun so a plane's shadow falls close beneath it.
   */
  aimSun(azimuth: number, elevation: number): void;
  /** A brief point of light for a muzzle flash or an explosion. */
  flash(position: Vector3, colour: ColorRepresentation, intensity: number, duration: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** A fixed pool, so the number of lights in every shader stays constant and nothing recompiles. */
const FLASH_LIGHTS = 4;

// Late afternoon: a warm, low sun for long shadows that show every height, and a cool sky fill so
// the shadows read blue against the warm sand.
const DAY: DayMood = {
  sun: '#ffd7a6',
  sunIntensity: 3.5,
  sky: '#b7cdf2',
  ground: '#b48a58',
  hemiIntensity: 0.6,
};

const NIGHT: NightMood = {
  lamp: '#ffcf8f',
  lampIntensity: 9500,
  lampAngle: 0.5,
  lampPenumbra: 0.9,
  moon: '#7ea4ff',
  moonIntensity: 0.95,
  sky: '#1c2a4d',
  ground: '#0d0b09',
  hemiIntensity: 0.32,
  shadowsFrom: 'lamp',
};

interface Flash {
  light: PointLight;
  peak: number;
  duration: number;
  age: number;
}

export function createLightRig(initial: Appearance, options: LightRigOptions): LightRig {
  const group = new Group();
  group.name = 'light-rig';
  const day = { ...DAY, ...options.mood?.day };
  const night = { ...NIGHT, ...options.mood?.night };
  const colours = {
    sun: new Color(day.sun),
    daySky: new Color(day.sky),
    dayGround: new Color(day.ground),
    lamp: new Color(night.lamp),
    moon: new Color(night.moon),
    nightSky: new Color(night.sky),
    nightGround: new Color(night.ground),
  };

  const hemisphere = new HemisphereLight(colours.daySky, colours.dayGround, day.hemiIntensity);
  group.add(hemisphere);

  const sun = createSun(options, colours.sun, day.sunIntensity);
  group.add(sun, sun.target);

  const lampOn = night.lampIntensity > 0;
  const lamp = createLamp(options, colours.lamp, night);
  group.add(lamp, lamp.target);

  const moonCastsShadows = night.shadowsFrom === 'moon';
  const moon = new DirectionalLight(colours.moon, night.moonIntensity);
  moon.position.set(40, 48, 34);
  if (moonCastsShadows) castBoardShadows(moon, options);
  group.add(moon, moon.target);

  const flashes: Flash[] = [];
  for (let index = 0; index < FLASH_LIGHTS; index++) {
    const light = new PointLight('#ffffff', 0, 34, 1.6);
    group.add(light);
    flashes.push({ light, peak: 0, duration: 1, age: 1 });
  }

  const palette = {
    keyDirection: new Vector3(),
    key: new Color(),
    ambient: new Color(),
  };

  let appearance: Appearance = initial;

  function setAppearance(next: Appearance): void {
    appearance = next;
    const isDay = next === 'light';
    sun.visible = isDay;
    sun.castShadow = isDay;
    lamp.visible = !isDay && lampOn;
    lamp.castShadow = !isDay && lampOn && !moonCastsShadows;
    moon.visible = !isDay;
    moon.castShadow = !isDay && moonCastsShadows;
    hemisphere.color.copy(isDay ? colours.daySky : colours.nightSky);
    hemisphere.groundColor.copy(isDay ? colours.dayGround : colours.nightGround);
    hemisphere.intensity = isDay ? day.hemiIntensity : night.hemiIntensity;

    const nightKey = lampOn && !moonCastsShadows ? lamp : moon;
    const key: Object3D = isDay ? sun : nightKey;
    palette.keyDirection.copy(key.position).normalize();
    // Smoke at night is lit mostly by fire and the lamp's edge, so it stays dark against the board.
    palette.key
      .copy(isDay ? colours.sun : nightKey === lamp ? colours.lamp : colours.moon)
      .multiplyScalar(isDay ? 1 : 0.42);
    palette.ambient.copy(isDay ? colours.daySky : colours.moon).multiplyScalar(isDay ? 0.55 : 0.16);
  }

  setAppearance(initial);

  function aimSun(azimuth: number, elevation: number): void {
    const distance = 66;
    const up = (elevation * Math.PI) / 180;
    const round = (azimuth * Math.PI) / 180;
    sun.position.set(
      -Math.sin(round) * Math.cos(up) * distance,
      Math.sin(up) * distance,
      -Math.cos(round) * Math.cos(up) * distance,
    );
    moon.position.set(-sun.position.x, sun.position.y, -sun.position.z);
    setAppearance(appearance);
  }

  return {
    aimSun,
    group,
    get appearance() {
      return appearance;
    },
    palette,
    setAppearance,
    flash(position, colour, intensity, duration) {
      const slot = flashes.reduce((oldest, candidate) =>
        candidate.age / candidate.duration > oldest.age / oldest.duration ? candidate : oldest,
      );
      slot.light.position.copy(position);
      slot.light.color.set(colour);
      // Night flashes carry the scene; by day the sun already lights everything.
      slot.peak = intensity * (appearance === 'dark' ? 1 : 0.35);
      slot.duration = duration;
      slot.age = 0;
    },
    update(dt) {
      for (const flash of flashes) {
        flash.age = Math.min(flash.duration, flash.age + dt);
        const remaining = 1 - flash.age / flash.duration;
        flash.light.intensity = flash.peak * remaining * remaining;
      }
    },
    dispose() {
      sun.shadow.map?.dispose();
      lamp.shadow.map?.dispose();
      moon.shadow.map?.dispose();
      group.removeFromParent();
    },
  };
}

/** Low and from the back left, so shadows fall long towards the viewer and show every height. */
function createSun(options: LightRigOptions, colour: Color, intensity: number): DirectionalLight {
  const sun = new DirectionalLight(colour, intensity);
  sun.position.set(-48, 38, -24);
  sun.target.position.set(0, 0, 0);
  castBoardShadows(sun, options);
  return sun;
}

/** A shadow camera that covers the whole board from a directional light. */
function castBoardShadows(light: DirectionalLight, options: LightRigOptions): void {
  const shadow = light.shadow;
  shadow.mapSize.set(options.shadowMapSize, options.shadowMapSize);
  const reach = Math.hypot(options.halfWidth, options.halfDepth) + 4;
  shadow.camera.left = -reach;
  shadow.camera.right = reach;
  shadow.camera.top = reach;
  shadow.camera.bottom = -reach;
  shadow.camera.near = 10;
  shadow.camera.far = 140;
  shadow.bias = -0.0004;
  shadow.normalBias = 0.03;
  shadow.radius = 1.6;
}

/** A desk lamp above the back-left corner: one warm pool that covers the board and fades past it. */
function createLamp(options: LightRigOptions, colour: Color, night: NightMood): SpotLight {
  const lamp = new SpotLight(
    colour,
    night.lampIntensity,
    0,
    night.lampAngle,
    night.lampPenumbra,
    2,
  );
  lamp.position.set(-8, 70, -12);
  lamp.target.position.set(0, 0, 2);
  const shadow = lamp.shadow;
  shadow.mapSize.set(options.shadowMapSize, options.shadowMapSize);
  shadow.camera.near = 20;
  shadow.camera.far = 160;
  shadow.bias = -0.0003;
  shadow.normalBias = 0.03;
  shadow.radius = 3;
  shadow.focus = 0.9;
  return lamp;
}
