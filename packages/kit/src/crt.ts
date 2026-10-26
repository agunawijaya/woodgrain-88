/**
 * A procedural CRT for The Den's television and for demos: it takes any
 * canvas as the picture and shows it through curved glass with scanlines,
 * glow and the moments that make an old set feel alive: the picture
 * collapsing to a line and a dot at power-off, the warm-up, the degauss
 * wobble, snow between channels and the picture rolling into place.
 *
 * Everything is one WebGL fragment shader driven by a handful of uniforms;
 * animations are tweens on those uniforms. Without WebGL it falls back to a
 * plain Canvas 2D copy with noise. With effects off there is no curvature,
 * scanline or glow; under reduced motion every transition becomes a short
 * cross-fade and snow stays still.
 */
import type { Rgb } from './color.ts';

export interface CrtOptions {
  /** Curvature, scanlines and glow. */
  effects?: boolean;
  reducedMotion?: boolean;
  /** Source rows per scanline pair; usually the picture's pixel height. Default 240. */
  scanlineRows?: number;
}

export interface PowerOnOptions {
  /** How long the snow lasts before the picture arrives. Default 300 ms. */
  snowMs?: number;
  /** Roll the picture once into place. Default true. */
  roll?: boolean;
}

export interface CrtScreen {
  /** The display canvas, created and owned by the CRT, already inside the host. */
  readonly canvas: HTMLCanvasElement;
  readonly powered: boolean;
  /** The picture to show; null shows black glass (or snow, if snow is up). */
  setSource(source: HTMLCanvasElement | null): void;
  setEffects(on: boolean): void;
  setReducedMotion(on: boolean): void;
  /** Collapse to a bright line, then a dot, then dark (~250 ms). */
  powerOff(): Promise<void>;
  /** Warm up from a dot with a degauss wobble, snow, then roll into the picture. */
  powerOn(options?: PowerOnOptions): Promise<void>;
  /** A burst of static, as when changing channel. */
  snow(ms: number, level?: number): Promise<void>;
  /** A standing snow level 0–1 under the picture (holding P makes it grow). */
  setSnowFloor(level: number): void;
  /** Rewinds the picture with a quick roll, as the RESET lever does. */
  roll(ms?: number): Promise<void>;
  /** The picture's average colour, sampled small; null when dark or without a picture. */
  sampleColor(): Rgb | null;
  /** Stops drawing (off-screen); `resume` starts again. */
  pause(): void;
  resume(): void;
  dispose(): void;
}

interface Uniforms {
  power: number;
  squashX: number;
  squashY: number;
  snow: number;
  snowFloor: number;
  roll: number;
  wobble: number;
  flash: number;
}

interface Tween {
  key: keyof Uniforms;
  from: number;
  to: number;
  start: number;
  duration: number;
  ease: (t: number) => number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;
const linear = (t: number) => t;

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// One pass: geometry (squash, curvature, roll, wobble), picture with
// chromatic wobble and glow, then snow, scanlines, vignette and power.
const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_picture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_hasPicture;
uniform float u_curvature;
uniform float u_scanlines;
uniform float u_rows;
uniform float u_glow;
uniform float u_power;
uniform vec2 u_squash;
uniform float u_snow;
uniform float u_roll;
uniform float u_wobble;
uniform float u_flash;
varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 picture(vec2 uv) {
  return texture2D(u_picture, vec2(uv.x, 1.0 - uv.y)).rgb;
}

void main() {
  vec2 cc = v_uv * 2.0 - 1.0;
  float r2 = dot(cc, cc);
  cc *= (1.0 + u_curvature * r2) / (1.0 + u_curvature);

  vec2 squashed = cc / max(u_squash, vec2(0.0005));
  float inside = step(abs(squashed.x), 1.0) * step(abs(squashed.y), 1.0);
  vec2 edge = smoothstep(vec2(1.0), vec2(0.985), abs(cc));
  float glass = edge.x * edge.y;

  vec2 uv = squashed * 0.5 + 0.5;
  uv.x += sin(uv.y * 18.0 + u_time * 24.0) * 0.012 * u_wobble;
  float rolled = fract(uv.y + u_roll);
  float rollBar = 1.0 - 0.85 * smoothstep(0.0, 0.04, u_roll) * (1.0 - smoothstep(0.0, 0.06, abs(rolled - 0.0)));
  uv.y = rolled;

  vec3 color = vec3(0.0);
  if (u_hasPicture > 0.5) {
    float fringe = 0.003 + 0.01 * u_wobble;
    color = vec3(
      picture(uv + vec2(fringe, 0.0)).r,
      picture(uv).g,
      picture(uv - vec2(fringe, 0.0)).b
    );
    vec2 px = 1.5 / u_resolution;
    vec3 blur = picture(uv + vec2(px.x, 0.0)) + picture(uv - vec2(px.x, 0.0))
              + picture(uv + vec2(0.0, px.y)) + picture(uv - vec2(0.0, px.y));
    color += blur * 0.25 * 0.35 * u_glow;
    color = mix(color, color * vec3(1.15, 0.9, 1.2), u_wobble * 0.5);
  }
  color *= rollBar;

  float grain = hash(floor(gl_FragCoord.xy / 2.0) + floor(u_time * 60.0) * vec2(1.7, 9.2));
  float tear = step(0.985, hash(vec2(floor(gl_FragCoord.y / 3.0), floor(u_time * 30.0))));
  vec3 snow = vec3(0.55 * grain + 0.25 * tear + 0.08);
  color = mix(color, snow, clamp(u_snow, 0.0, 1.0));

  float scan = 0.5 + 0.5 * sin(uv.y * u_rows * 6.28318);
  color *= mix(1.0, 0.72 + 0.28 * scan, u_scanlines);

  float vignette = 1.0 - 0.28 * r2 * (u_curvature > 0.0 ? 1.0 : 0.4);
  color *= vignette;

  // A collapsing picture concentrates its energy into a thin, bright line.
  float squeeze = clamp(0.06 / min(u_squash.x, u_squash.y), 1.0, 6.0);
  color = color * squeeze + u_flash;

  gl_FragColor = vec4(color * u_power * inside * glass, 1.0);
}`;

interface GlState {
  gl: WebGLRenderingContext;
  texture: WebGLTexture;
  locations: Record<string, WebGLUniformLocation | null>;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

const UNIFORM_NAMES = [
  'u_picture',
  'u_resolution',
  'u_time',
  'u_hasPicture',
  'u_curvature',
  'u_scanlines',
  'u_rows',
  'u_glow',
  'u_power',
  'u_squash',
  'u_snow',
  'u_roll',
  'u_wobble',
  'u_flash',
] as const;

function setUpGl(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const locations: Record<string, WebGLUniformLocation | null> = {};
  for (const name of UNIFORM_NAMES) locations[name] = gl.getUniformLocation(program, name);
  return { gl, texture, locations };
}

export function createCrt(host: HTMLElement, options: CrtOptions = {}): CrtScreen {
  const canvas = document.createElement('canvas');
  canvas.className = 'crt-screen';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  let effects = options.effects ?? true;
  let reducedMotion = options.reducedMotion ?? false;
  const rows = options.scanlineRows ?? 240;
  let source: HTMLCanvasElement | null = null;
  let powered = true;
  let running = true;
  let frame: number | null = null;
  const uniforms: Uniforms = {
    power: 1,
    squashX: 1,
    squashY: 1,
    snow: 0,
    snowFloor: 0,
    roll: 0,
    wobble: 0,
    flash: 0,
  };
  let tweens: Tween[] = [];

  const glState = setUpGl(canvas);
  const fallback = glState ? null : canvas.getContext('2d');
  const sampler = document.createElement('canvas');
  sampler.width = 8;
  sampler.height = 8;
  const sampleContext = sampler.getContext('2d', { willReadFrequently: true });

  const resize = () => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(host.clientWidth * ratio));
    const height = Math.max(1, Math.round(host.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(host);
  resize();

  const animate = (key: keyof Uniforms, to: number, duration: number, ease = easeOut) => {
    tweens = tweens.filter((tween) => tween.key !== key);
    if (duration <= 0) {
      uniforms[key] = to;
      return;
    }
    tweens.push({ key, from: uniforms[key], to, start: performance.now(), duration, ease });
  };

  const advanceTweens = (now: number) => {
    tweens = tweens.filter((tween) => {
      const t = Math.min(1, (now - tween.start) / tween.duration);
      uniforms[tween.key] = tween.from + (tween.to - tween.from) * tween.ease(t);
      return t < 1;
    });
  };

  const drawGl = (state: GlState, now: number) => {
    const { gl, locations } = state;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const hasPicture = source !== null && source.width > 0 && source.height > 0;
    if (hasPicture && source) {
      gl.bindTexture(gl.TEXTURE_2D, state.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    }
    const snowLevel = Math.max(uniforms.snow, uniforms.snowFloor);
    gl.uniform1i(locations.u_picture ?? null, 0);
    gl.uniform2f(locations.u_resolution ?? null, canvas.width, canvas.height);
    gl.uniform1f(locations.u_time ?? null, reducedMotion ? 0 : now / 1000);
    gl.uniform1f(locations.u_hasPicture ?? null, hasPicture ? 1 : 0);
    gl.uniform1f(locations.u_curvature ?? null, effects ? 0.09 : 0);
    gl.uniform1f(locations.u_scanlines ?? null, effects ? 0.55 : 0);
    gl.uniform1f(locations.u_rows ?? null, rows);
    gl.uniform1f(locations.u_glow ?? null, effects ? 1 : 0);
    gl.uniform1f(locations.u_power ?? null, uniforms.power);
    gl.uniform2f(locations.u_squash ?? null, uniforms.squashX, uniforms.squashY);
    gl.uniform1f(locations.u_snow ?? null, snowLevel);
    gl.uniform1f(locations.u_roll ?? null, uniforms.roll);
    gl.uniform1f(locations.u_wobble ?? null, uniforms.wobble);
    gl.uniform1f(locations.u_flash ?? null, uniforms.flash);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // Snow only has to look random; a tiny xorshift keeps Math.random out of the kit.
  let grainState = 0x9e3779b9;
  const nextGrain = () => {
    grainState ^= grainState << 13;
    grainState ^= grainState >>> 17;
    grainState ^= grainState << 5;
    return (grainState >>> 0) / 4294967296;
  };

  const draw2d = (context: CanvasRenderingContext2D) => {
    const { width, height } = canvas;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.save();
    context.globalAlpha = uniforms.power;
    context.translate(width / 2, height / 2);
    context.scale(uniforms.squashX, uniforms.squashY);
    if (source) context.drawImage(source, -width / 2, -height / 2, width, height);
    context.restore();
    const snowLevel = Math.max(uniforms.snow, uniforms.snowFloor);
    if (snowLevel > 0.01) {
      context.globalAlpha = snowLevel * uniforms.power;
      for (let i = 0; i < 400; i++) {
        const shade = Math.floor(nextGrain() * 200 + 40);
        context.fillStyle = `rgb(${shade},${shade},${shade})`;
        context.fillRect(nextGrain() * width, nextGrain() * height, 3, 2);
      }
      context.globalAlpha = 1;
    }
  };

  const render = (now: number) => {
    frame = null;
    if (!running) return;
    advanceTweens(now);
    if (glState) drawGl(glState, now);
    else if (fallback) draw2d(fallback);
    frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const screen: CrtScreen = {
    canvas,
    get powered() {
      return powered;
    },
    setSource(next) {
      source = next;
    },
    setEffects(on) {
      effects = on;
    },
    setReducedMotion(on) {
      reducedMotion = on;
    },
    async powerOff() {
      powered = false;
      if (reducedMotion) {
        animate('power', 0, 200, linear);
        await wait(200);
        return;
      }
      animate('flash', 0.25, 60, easeOut);
      animate('squashY', 0.006, 130, easeIn);
      await wait(130);
      animate('flash', 0.6, 40);
      animate('squashX', 0.012, 90, easeIn);
      await wait(90);
      animate('power', 0, 70, linear);
      animate('flash', 0, 70, linear);
      await wait(70);
      uniforms.squashX = 0.012;
      uniforms.squashY = 0.006;
    },
    async powerOn(powerOptions = {}) {
      powered = true;
      const snowMs = powerOptions.snowMs ?? 300;
      if (reducedMotion) {
        uniforms.squashX = 1;
        uniforms.squashY = 1;
        uniforms.snow = 0;
        animate('power', 1, 260, linear);
        await wait(260);
        return;
      }
      uniforms.squashX = 0.012;
      uniforms.squashY = 0.006;
      uniforms.snow = 1;
      animate('power', 1, 80, linear);
      animate('flash', 0.5, 60);
      await wait(70);
      animate('squashX', 1, 120, easeOut);
      animate('flash', 0, 200, linear);
      await wait(90);
      animate('squashY', 1, 140, easeOut);
      uniforms.wobble = 1;
      animate('wobble', 0, 700, easeOut);
      await wait(Math.max(0, snowMs - 160));
      animate('snow', 0, 160, linear);
      if (powerOptions.roll ?? true) {
        uniforms.roll = 0.999;
        animate('roll', 0, 420, easeOut);
      }
      await wait(160);
    },
    async snow(ms, level = 1) {
      if (reducedMotion) {
        animate('power', 0.35, 90, linear);
        await wait(ms);
        animate('power', 1, 120, linear);
        return;
      }
      uniforms.snow = level;
      await wait(ms);
      animate('snow', 0, 120, linear);
    },
    setSnowFloor(level) {
      uniforms.snowFloor = Math.max(0, Math.min(1, level));
    },
    async roll(ms = 380) {
      if (reducedMotion) return;
      uniforms.roll = 0.999;
      animate('roll', 0, ms, easeOut);
      await wait(ms);
    },
    sampleColor() {
      if (!source || !powered || !sampleContext || source.width === 0) return null;
      sampleContext.drawImage(source, 0, 0, 8, 8);
      const pixels = sampleContext.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i] ?? 0;
        g += pixels[i + 1] ?? 0;
        b += pixels[i + 2] ?? 0;
      }
      const count = pixels.length / 4;
      return { r: r / count, g: g / count, b: b / count };
    },
    pause() {
      running = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
    resume() {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(render);
    },
    dispose() {
      screen.pause();
      observer?.disconnect();
      const lose = glState?.gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
      canvas.remove();
    },
  };
  return screen;
}
