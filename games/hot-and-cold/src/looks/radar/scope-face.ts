/**
 * The Radar Room's display: a flat plotting scope, not a television. Its
 * printed layer (the 9 × 7 plot with lettered columns and numbered rows,
 * faint range rings and crosshairs) is drawn once on a canvas; a shader
 * lays it on the display with the sweep going round and the afterglow
 * trailing it. By day the display is a sunlight-readable light panel with
 * dark ink; by night it is deep phosphor green on black.
 */
import {
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector4,
  type IUniform,
} from 'three';
import { COLUMNS, ROWS } from '../../engine/grid.ts';
import { FIELD_DEPTH, FIELD_WIDTH, SQUARE_SIZE } from '../../look/field-space.ts';
import { DISPLAY_FONT } from '../../look/glyphs.ts';

export const SCREEN_WIDTH = FIELD_WIDTH + 8;
export const SCREEN_DEPTH = FIELD_DEPTH + 7;
/** Seconds for one turn of the sweep. */
export const SWEEP_SECONDS = 4;
const TEXELS_PER_UNIT = 46;
/** Pings drawn at once; a new one replaces the oldest. */
const PINGS = 4;
const PING_SPEED = 22;

export interface ScopeFace {
  readonly mesh: Mesh;
  /** The sweep's angle, radians, measured as `Math.atan2(z, x)` from the field's middle. */
  readonly sweep: number;
  /** A ring of light rolling out from a point across the whole display, in `colour`. */
  ping(x: number, z: number, colour: Color): void;
  /** The possibility fog: squares marked false are hatched over; null clears it. */
  setFog(possible: readonly boolean[] | null): void;
  update(dt: number): void;
  dispose(): void;
}

/** How strongly a point at angle `angle` is lit by the passing sweep: 1 just behind the beam, fading. */
export function afterglow(sweep: number, angle: number): number {
  const behind = (((sweep - angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.exp(-behind * 1.6);
}

export function createScopeFace(night: boolean): ScopeFace {
  const ink = drawInk();
  const time: IUniform<number> = { value: 0 };
  const sweep: IUniform<number> = { value: -Math.PI / 2 };
  // Each ping: x, z, age in seconds (negative when unused), and a slot for its colour below.
  const pings = Array.from({ length: PINGS }, () => new Vector4(0, 0, -1, 0));
  const pingColours = Array.from({ length: PINGS }, () => new Color());
  let nextPing = 0;
  const fog = new Float32Array(COLUMNS * ROWS).fill(1);
  const geometry = new PlaneGeometry(SCREEN_WIDTH, SCREEN_DEPTH);
  geometry.rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    uniforms: {
      ink: { value: ink },
      time,
      sweep,
      night: { value: night ? 1 : 0 },
      paper: { value: new Color(night ? '#020a06' : '#c4d3bb') },
      inkColour: { value: new Color(night ? '#1f8f4c' : '#173322') },
      pings: { value: pings },
      fog: { value: fog },
      squareSize: { value: SQUARE_SIZE },
      fieldHalf: { value: [FIELD_WIDTH / 2, FIELD_DEPTH / 2] },
      pingColours: { value: pingColours },
      beamColour: { value: new Color(night ? '#56ff9a' : '#2f6a48') },
      halfSize: { value: [SCREEN_WIDTH / 2, SCREEN_DEPTH / 2] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vField;
      void main() {
        vUv = uv;
        vField = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D ink;
      uniform float time;
      uniform float sweep;
      uniform float night;
      uniform vec3 paper;
      uniform vec3 inkColour;
      uniform vec3 beamColour;
      uniform vec2 halfSize;
      uniform vec4 pings[${PINGS}];
      uniform float fog[${COLUMNS * ROWS}];
      uniform float squareSize;
      uniform vec2 fieldHalf;
      uniform vec3 pingColours[${PINGS}];
      varying vec2 vUv;
      varying vec2 vField;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        float marks = texture2D(ink, vUv).a;
        float angle = atan(vField.y, vField.x);
        float behind = mod(sweep - angle, 6.2831853);
        float trail = exp(-behind * 1.6);
        float beam = smoothstep(0.035, 0.0, behind) * smoothstep(0.0, 2.0, length(vField));
        // A soft inner shade at the display's edge, where the bezel overhangs it.
        vec2 toEdge = halfSize - abs(vField);
        float inner = smoothstep(0.0, 1.6, min(toEdge.x, toEdge.y));
        vec3 colour;
        if (night > 0.5) {
          float grain = (hash(floor(vField * 22.0) + floor(time * 24.0)) - 0.5) * 0.012;
          colour = paper + grain + beamColour * trail * 0.07;
          colour += inkColour * marks * (0.55 + 0.9 * trail);
          colour += beamColour * beam * 1.6;
        } else {
          colour = paper * (0.97 + 0.03 * hash(floor(vField * 30.0)));
          colour = mix(colour, inkColour, marks * 0.92);
          colour = mix(colour, beamColour, trail * 0.09 + beam * 0.45);
        }
        // Squares the flag cannot be on are hatched over, quietly.
        vec2 inField = vField + fieldHalf;
        if (all(greaterThanEqual(inField, vec2(0.0))) && all(lessThan(inField, fieldHalf * 2.0))) {
          ivec2 cell = ivec2(floor(inField / squareSize));
          float possible = fog[cell.y * ${COLUMNS} + cell.x];
          float hatch = step(0.5, fract((vField.x + vField.y) * 1.6));
          colour = mix(colour, mix(colour * 0.55, paper * 0.85, night), (1.0 - possible) * (0.55 + 0.25 * hatch));
        }
        for (int index = 0; index < ${PINGS}; index++) {
          vec4 ping = pings[index];
          if (ping.z < 0.0) continue;
          float radius = ping.z * ${PING_SPEED.toFixed(1)};
          float ring = 1.0 - smoothstep(0.0, 0.16, abs(length(vField - ping.xy) - radius));
          float fade = max(0.0, 1.0 - ping.z / 1.6);
          colour = mix(colour, pingColours[index], ring * fade * (night > 0.5 ? 1.0 : 0.8));
          colour += pingColours[index] * ring * fade * night * 0.6;
        }
        colour *= mix(0.55, 1.0, inner);
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'scope-face';
  mesh.receiveShadow = true;
  return {
    mesh,
    get sweep() {
      return sweep.value;
    },
    setFog(possible) {
      for (let square = 0; square < fog.length; square++) {
        fog[square] = possible !== null && possible[square] === false ? 0 : 1;
      }
    },
    ping(x, z, colour) {
      const slot = nextPing % PINGS;
      nextPing++;
      pings[slot]?.set(x, z, 0, 0);
      pingColours[slot]?.copy(colour);
    },
    update(dt) {
      time.value += dt;
      for (const entry of pings) {
        if (entry.z >= 0) entry.z = entry.z > 1.6 ? -1 : entry.z + dt;
      }
      sweep.value =
        ((sweep.value + (dt / SWEEP_SECONDS) * Math.PI * 2 + Math.PI) % (Math.PI * 2)) - Math.PI;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      ink.dispose();
    },
  };
}

/** The printed layer, white on clear: plot, labels, range rings and crosshair. */
function drawInk(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(SCREEN_WIDTH * TEXELS_PER_UNIT);
  canvas.height = Math.round(SCREEN_DEPTH * TEXELS_PER_UNIT);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  const draw = () => {
    const context = canvas.getContext('2d');
    if (!context) return;
    const unit = TEXELS_PER_UNIT;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(unit, unit);
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#ffffff';

    // Range rings and crosshair, faint and dashed, centred on the plot.
    context.globalAlpha = 0.32;
    context.lineWidth = 0.05;
    context.setLineDash([0.4, 0.3]);
    for (const radius of [6, 12, 18]) {
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(-SCREEN_WIDTH / 2 + 1, 0);
    context.lineTo(SCREEN_WIDTH / 2 - 1, 0);
    context.moveTo(0, -SCREEN_DEPTH / 2 + 1);
    context.lineTo(0, SCREEN_DEPTH / 2 - 1);
    context.stroke();
    context.setLineDash([]);

    // The plot: thin lines between squares, a firm border with tick marks.
    const left = -FIELD_WIDTH / 2;
    const top = -FIELD_DEPTH / 2;
    context.globalAlpha = 0.75;
    context.lineWidth = 0.06;
    for (let column = 1; column < COLUMNS; column++) {
      context.beginPath();
      context.moveTo(left + column * SQUARE_SIZE, top);
      context.lineTo(left + column * SQUARE_SIZE, -top);
      context.stroke();
    }
    for (let row = 1; row < ROWS; row++) {
      context.beginPath();
      context.moveTo(left, top + row * SQUARE_SIZE);
      context.lineTo(-left, top + row * SQUARE_SIZE);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.lineWidth = 0.16;
    context.strokeRect(left, top, FIELD_WIDTH, FIELD_DEPTH);
    context.lineWidth = 0.07;
    for (let step = 0; step <= FIELD_WIDTH; step++) {
      const reach = step % SQUARE_SIZE === 0 ? 0.6 : 0.3;
      context.beginPath();
      context.moveTo(left + step, top);
      context.lineTo(left + step, top - reach);
      context.moveTo(left + step, -top);
      context.lineTo(left + step, -top + reach);
      context.stroke();
    }
    for (let step = 0; step <= FIELD_DEPTH; step++) {
      const reach = step % SQUARE_SIZE === 0 ? 0.6 : 0.3;
      context.beginPath();
      context.moveTo(left, top + step);
      context.lineTo(left - reach, top + step);
      context.moveTo(-left, top + step);
      context.lineTo(-left + reach, top + step);
      context.stroke();
    }

    // Columns lettered A to I along the top, rows numbered 1 to 7 down the left.
    context.font = `700 1.5px ${DISPLAY_FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let column = 0; column < COLUMNS; column++) {
      context.fillText(
        String.fromCharCode(65 + column),
        left + (column + 0.5) * SQUARE_SIZE,
        top - 1.6,
      );
    }
    for (let row = 0; row < ROWS; row++) {
      context.fillText(String(row + 1), left - 1.7, top + (row + 0.5) * SQUARE_SIZE);
    }
    texture.needsUpdate = true;
  };
  draw();
  void document.fonts.load(`700 64px ${DISPLAY_FONT}`).then(draw, () => undefined);
  return texture;
}
