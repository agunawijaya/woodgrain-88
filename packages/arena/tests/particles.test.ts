/**
 * Tests for the tabletop particle engine: lifecycle and capacity limits,
 * bouncing physics on the ground plane, instanced buffer updates, back-to-front
 * camera sorting for smoke, and glow source light limits.
 */
import { describe, expect, it } from 'vitest';
import {
  Color,
  InstancedBufferGeometry,
  OrthographicCamera,
  type ShaderMaterial,
  Vector3,
  type Vector4,
} from 'three';
import { createParticleField, type GlowSource, type ParticleSpawn } from '../src/particles.ts';
import type { LightPalette } from '../src/lighting.ts';

function assertDefined<T>(
  value: T | undefined | null,
  message = 'Expected value to be defined',
): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}

function createTestPalette(): LightPalette {
  return {
    keyDirection: new Vector3(0.5, 1, 0.5).normalize(),
    key: new Color('#fff5e0'),
    ambient: new Color('#405070'),
  };
}

function createTestCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-10, 10, 10, -10, 1, 100);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

describe('createParticleField', () => {
  it('increments count on emit, removes expired particles, and empties on clear', () => {
    const palette = createTestPalette();
    const camera = createTestCamera();
    const field = createParticleField('glow', 10, palette);

    expect(field.count).toBe(0);

    const spawn: ParticleSpawn = {
      x: 0,
      y: 1,
      z: 0,
      life: 0.5,
      size: 1,
      colour: new Color('#ffffff'),
    };

    field.emit(spawn);
    field.emit(spawn);
    expect(field.count).toBe(2);

    field.update(0.2, camera);
    expect(field.count).toBe(2);

    // Total age exceeds 0.5 second lifetime
    field.update(0.35, camera);
    expect(field.count).toBe(0);

    field.emit(spawn);
    field.emit(spawn);
    field.emit(spawn);
    expect(field.count).toBe(3);

    field.clear();
    expect(field.count).toBe(0);
  });

  it('ignores emits that exceed maximum capacity', () => {
    const palette = createTestPalette();
    const field = createParticleField('glow', 3, palette);

    const spawn: ParticleSpawn = {
      x: 0,
      y: 0,
      z: 0,
      life: 10,
      size: 1,
      colour: new Color('#ffaa00'),
    };

    field.emit(spawn);
    field.emit(spawn);
    field.emit(spawn);
    expect(field.count).toBe(3);

    field.emit(spawn);
    field.emit(spawn);
    expect(field.count).toBe(3);
  });

  it('never drops below ground level y=0 and rebounds on bounce', () => {
    const palette = createTestPalette();
    const camera = createTestCamera();
    const field = createParticleField('glow', 5, palette);

    field.emit({
      x: 0,
      y: 1,
      z: 0,
      lift: -10,
      bounce: 0.5,
      life: 5,
      size: 1,
      colour: new Color('#ffffff'),
    });

    const posAttr = field.mesh.geometry.getAttribute('iPosition');
    let hitGround = false;
    let bouncedUp = false;
    let previousY = 1;

    for (let step = 0; step < 50; step++) {
      field.update(0.02, camera);
      const currentY = posAttr.getY(0);

      // Simulation must clamp y >= 0 on ground contact
      expect(currentY).toBeGreaterThanOrEqual(0);

      if (currentY === 0 || (currentY < previousY && currentY < 0.1)) {
        hitGround = true;
      }
      if (hitGround && currentY > previousY) {
        bouncedUp = true;
      }
      previousY = currentY;
    }

    expect(hitGround).toBe(true);
    expect(bouncedUp).toBe(true);
  });

  it('updates InstancedBufferGeometry instanceCount and uploads positions in emit order for glow', () => {
    const palette = createTestPalette();
    const camera = createTestCamera();
    const field = createParticleField('glow', 10, palette);

    field.emit({
      x: 10,
      y: 20,
      z: 30,
      life: 2,
      size: 1,
      colour: new Color('#ff0000'),
    });
    field.emit({
      x: 40,
      y: 50,
      z: 60,
      life: 2,
      size: 1,
      colour: new Color('#00ff00'),
    });

    field.update(0, camera);

    expect(field.mesh.geometry).toBeInstanceOf(InstancedBufferGeometry);
    const geometry = field.mesh.geometry as InstancedBufferGeometry;
    expect(geometry.instanceCount).toBe(2);

    const pos = geometry.getAttribute('iPosition');
    expect(pos.getX(0)).toBe(10);
    expect(pos.getY(0)).toBe(20);
    expect(pos.getZ(0)).toBe(30);

    expect(pos.getX(1)).toBe(40);
    expect(pos.getY(1)).toBe(50);
    expect(pos.getZ(1)).toBe(60);
  });

  it('sorts smoke particles back-to-front relative to camera view direction', () => {
    const palette = createTestPalette();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const field = createParticleField('smoke', 10, palette);

    // Emit nearer particle first, then farther particle
    field.emit({
      x: 0,
      y: 0,
      z: -2,
      life: 5,
      size: 1,
      colour: new Color('#888888'),
    });
    field.emit({
      x: 0,
      y: 0,
      z: -10,
      life: 5,
      size: 1,
      colour: new Color('#888888'),
    });

    field.update(0, camera);

    const pos = field.mesh.geometry.getAttribute('iPosition');
    // Looking down -z: z = -10 is farther from camera than z = -2, so uploaded first
    expect(pos.getZ(0)).toBe(-10);
    expect(pos.getZ(1)).toBe(-2);
  });

  it('limits glow sources to first four and zeroes strength when sources list is empty', () => {
    const palette = createTestPalette();
    const field = createParticleField('smoke', 10, palette);
    const material = field.mesh.material as ShaderMaterial;

    const glowUniform = assertDefined(material.uniforms.glowPositions);
    const glowPositions = glowUniform.value as Vector4[];
    expect(glowPositions).toHaveLength(4);

    const fiveSources: GlowSource[] = [
      { position: new Vector3(1, 2, 3), colour: new Color('#ff0000'), strength: 0.9 },
      { position: new Vector3(4, 5, 6), colour: new Color('#00ff00'), strength: 0.8 },
      { position: new Vector3(7, 8, 9), colour: new Color('#0000ff'), strength: 0.7 },
      { position: new Vector3(10, 11, 12), colour: new Color('#ffff00'), strength: 0.6 },
      { position: new Vector3(13, 14, 15), colour: new Color('#ff00ff'), strength: 0.5 },
    ];

    field.setGlowSources(fiveSources);

    const first = assertDefined(glowPositions[0]);
    const second = assertDefined(glowPositions[1]);
    const third = assertDefined(glowPositions[2]);
    const fourth = assertDefined(glowPositions[3]);

    expect(first.x).toBe(1);
    expect(first.w).toBe(0.9);
    expect(second.x).toBe(4);
    expect(second.w).toBe(0.8);
    expect(third.x).toBe(7);
    expect(third.w).toBe(0.7);
    expect(fourth.x).toBe(10);
    expect(fourth.w).toBe(0.6);

    // Uniform array length remains capped at 4
    expect(glowPositions).toHaveLength(4);

    // Empty list zeroes all strengths (w component)
    field.setGlowSources([]);
    for (const pos of glowPositions) {
      expect(pos.w).toBe(0);
    }
  });
});
