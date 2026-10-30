/**
 * Deep Space's star: a living ball of plasma that churns slowly, a corona
 * that breathes, and now and then a flare that arcs off its limb and falls
 * back. It is the most dangerous thing on the field, so it is also the
 * brightest; by day its glow is held back so the planetarium stays crisp.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  Group,
  type Camera,
} from 'three';
import type { ParticleField } from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';

/** The star's radius in units: what a ship must not touch. */
export const STAR_RADIUS = 1.05;

export interface DeepStar {
  readonly root: Group;
  /** A missile fell in: the star answers with a flare. */
  swallow(): void;
  update(dt: number, clock: number, camera: Camera): void;
  dispose(): void;
}

const SURFACE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHeat;
  uniform float uDay;
  varying vec3 vNormal;
  varying vec3 vLocal;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 p = vLocal * 3.2;
    float churn = noise(p + vec3(0.0, uTime * 0.35, 0.0)) * 0.6
                + noise(p * 2.1 - vec3(uTime * 0.25, 0.0, 0.0)) * 0.3
                + noise(p * 4.3 + vec3(0.0, 0.0, uTime * 0.5)) * 0.1;
    // The limb darkens a little, the way a ball of light does.
    float facing = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    vec3 deep = vec3(1.0, 0.32, 0.06);
    vec3 hot = vec3(1.0, 0.86, 0.5);
    vec3 white = vec3(1.0, 0.98, 0.92);
    vec3 colour = mix(deep, hot, smoothstep(0.25, 0.6, churn));
    colour = mix(colour, white, smoothstep(0.62, 0.85, churn) * facing);
    colour *= mix(0.75, 1.0, facing);
    // By day the planetarium's sun: a clean yellow disc with a deeper orange limb and only a hint
    // of churn, crisp against the pale dome instead of a white blaze.
    vec3 sunny = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.82, 0.22), smoothstep(0.05, 0.55, facing));
    sunny = mix(sunny, vec3(1.0, 0.93, 0.6), smoothstep(0.55, 0.75, churn) * facing * 0.6);
    gl_FragColor = vec4(mix(colour, sunny, uDay) * uHeat, 1.0);
  }
`;

/** A soft round glow with faint rays, drawn once on a canvas. */
function coronaTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the corona');
  const centre = size / 2;
  const gradient = context.createRadialGradient(centre, centre, 0, centre, centre, centre);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,230,180,0.9)');
  gradient.addColorStop(0.35, 'rgba(255,170,90,0.35)');
  gradient.addColorStop(0.7, 'rgba(255,120,60,0.08)');
  gradient.addColorStop(1, 'rgba(255,100,50,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = 'lighter';
  for (let ray = 0; ray < 12; ray++) {
    const angle = (ray / 12) * Math.PI * 2 + (ray % 2) * 0.2;
    const length = centre * (ray % 3 === 0 ? 0.95 : 0.7);
    const rayGradient = context.createLinearGradient(
      centre,
      centre,
      centre + Math.cos(angle) * length,
      centre + Math.sin(angle) * length,
    );
    rayGradient.addColorStop(0, 'rgba(255,220,170,0.25)');
    rayGradient.addColorStop(1, 'rgba(255,200,150,0)');
    context.strokeStyle = rayGradient;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(centre, centre);
    context.lineTo(centre + Math.cos(angle) * length, centre + Math.sin(angle) * length);
    context.stroke();
  }
  return new CanvasTexture(canvas);
}

export function createDeepStar(options: {
  readonly night: boolean;
  readonly glow: ParticleField;
  readonly rng: Rng;
}): DeepStar {
  const { night, glow, rng } = options;
  const root = new Group();
  root.name = 'deep-star';

  const surfaceGeometry = new SphereGeometry(STAR_RADIUS, 48, 32);
  const surface = new ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: night ? 2.4 : 0.95 },
      uDay: { value: night ? 0 : 1 },
    },
  });
  const ball = new Mesh(surfaceGeometry, surface);
  ball.position.y = 0.6;
  root.add(ball);

  const corona = coronaTexture();
  const coronaGeometry = new PlaneGeometry(1, 1);
  // By night the corona is light added to black space; by day it is a warm halo laid over the
  // dome's blue, which added light would only wash out.
  const coronaMaterial = new MeshBasicMaterial({
    map: corona,
    color: night ? new Color(1, 1, 1).multiplyScalar(1.3) : new Color('#ffb35c'),
    transparent: true,
    opacity: night ? 1 : 0.85,
    depthWrite: false,
    blending: night ? AdditiveBlending : NormalBlending,
  });
  const halo = new Mesh(coronaGeometry, coronaMaterial);
  halo.position.y = 0.6;
  root.add(halo);

  // By day the planetarium's sun wears drawn rays, the way a star chart prints it.
  const rays = new Group();
  rays.position.y = 0.6;
  const rayMaterial = new MeshBasicMaterial({ color: '#f29a2e', transparent: true, opacity: 0.9 });
  const rayGeometry = new PlaneGeometry(1, 1);
  if (!night) {
    for (let ray = 0; ray < 16; ray++) {
      const long = ray % 2 === 0;
      const spike = new Mesh(rayGeometry, rayMaterial);
      spike.rotation.x = -Math.PI / 2;
      const angle = (ray / 16) * Math.PI * 2;
      const length = long ? 0.75 : 0.45;
      spike.scale.set(length, 0.07, 1);
      const reach = STAR_RADIUS + 0.25 + length / 2;
      spike.position.set(Math.cos(angle) * reach, 0, Math.sin(angle) * reach);
      spike.rotation.z = -angle;
      rays.add(spike);
    }
    root.add(rays);
  }

  // Its warm light on the hulls that pass it; by day the studio light does most of the work.
  const light = new PointLight('#ffb36b', night ? 60 : 18, 24, 1.6);
  light.position.y = 1.6;
  root.add(light);

  let nextFlare = 0.6;
  /** A flare: sparks leaving the limb on an arc that the star pulls back. */
  function flare(): void {
    const angle = rng.float(0, Math.PI * 2);
    const out = { x: Math.cos(angle), z: Math.sin(angle) };
    const tangent = { x: -out.z, z: out.x };
    const hot = new Color(4, 2.2, 0.8).multiplyScalar(night ? 1 : 0.5);
    for (let index = 0; index < 26; index++) {
      const speed = rng.float(1.2, 2.4);
      const sideways = rng.float(-0.8, 0.8);
      // Flares leave the limb wherever the star is (a binary star moves) and however big it is.
      const limb = STAR_RADIUS * 0.95 * root.scale.x;
      glow.emit({
        x: root.position.x + out.x * limb,
        y: 0.6 + rng.float(-0.2, 0.3),
        z: root.position.z + out.z * limb,
        vx: out.x * speed + tangent.x * sideways,
        vy: rng.float(0.2, 0.8),
        vz: out.z * speed + tangent.z * sideways,
        lift: -2,
        drag: 2.2,
        life: rng.float(0.5, 1.1),
        size: rng.float(0.08, 0.16),
        sizeEnd: 0.02,
        colour: hot,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.05,
        fadeIn: 0,
      });
    }
  }

  return {
    root,
    swallow: flare,
    update(dt, clock, camera) {
      const time = surface.uniforms.uTime;
      if (time) time.value = clock;
      halo.quaternion.copy(camera.quaternion);
      const breathe = 1 + Math.sin(clock * 1.7) * 0.04 + Math.sin(clock * 3.1) * 0.02;
      halo.scale.setScalar(STAR_RADIUS * (night ? 4.6 : 3.6) * breathe);
      ball.rotation.y += dt * 0.08;
      rays.rotation.y += dt * 0.12;
      nextFlare -= dt;
      if (nextFlare <= 0) {
        flare();
        nextFlare = rng.float(0.8, 2.2);
      }
    },
    dispose() {
      surfaceGeometry.dispose();
      surface.dispose();
      coronaGeometry.dispose();
      coronaMaterial.dispose();
      rayGeometry.dispose();
      rayMaterial.dispose();
      corona.dispose();
    },
  };
}
