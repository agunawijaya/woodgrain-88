/**
 * Tests for camera-facing ribbon trails: point spacing and head movement,
 * capacity truncation, fade-out decay, draw range calculation, vertex straddling
 * geometry perpendicular to the path, and opacity uniform scaling.
 */
import { describe, expect, it } from 'vitest';
import { Color, OrthographicCamera, type ShaderMaterial, Vector3 } from 'three';
import { createRibbon, type RibbonStyle } from '../src/ribbon.ts';

function assertDefined<T>(
  value: T | undefined | null,
  message = 'Expected value to be defined',
): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}

function createTestCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-20, 20, 20, -20, 1, 100);
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);
  camera.updateMatrixWorld();
  return camera;
}

describe('createRibbon', () => {
  it('adds points on push and only updates the head when a new point is closer than 0.12', () => {
    const camera = createTestCamera();
    const style: RibbonStyle = {
      look: 'glow',
      width: 1.0,
      colour: new Color('#00ffff'),
      fade: 2.0,
      maxPoints: 10,
    };
    const ribbon = createRibbon(style);

    ribbon.push(new Vector3(0, 0, 0));
    ribbon.push(new Vector3(1, 0, 0));
    ribbon.update(0, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(6); // 1 segment * 6 indices

    ribbon.push(new Vector3(2, 0, 0));
    ribbon.update(0, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(12); // 2 segments * 6 indices

    // Pushing closer than 0.12 to head (distance = 0.05) modifies head in place
    ribbon.push(new Vector3(2.05, 0, 0));
    ribbon.update(0, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(12);

    // The midpoint of the head vertex pair (index 2: vertices 4 and 5) reflects new head x
    const positions = ribbon.mesh.geometry.getAttribute('position');
    const midX = (positions.getX(4) + positions.getX(5)) / 2;
    expect(midX).toBeCloseTo(2.05, 5);
  });

  it('drops oldest points once maxPoints capacity is reached', () => {
    const camera = createTestCamera();
    const style: RibbonStyle = {
      look: 'smoke',
      width: 1.0,
      colour: new Color('#aaaaaa'),
      fade: 5.0,
      maxPoints: 3,
    };
    const ribbon = createRibbon(style);

    ribbon.push(new Vector3(0, 0, 0));
    ribbon.push(new Vector3(1, 0, 0));
    ribbon.push(new Vector3(2, 0, 0));
    ribbon.update(0, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(12); // (3 points - 1) * 6

    // 4th point exceeds capacity of 3, dropping (0, 0, 0)
    ribbon.push(new Vector3(3, 0, 0));
    ribbon.update(0, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(12);

    // First pair of vertices now straddles (1, 0, 0)
    const positions = ribbon.mesh.geometry.getAttribute('position');
    const tailMidX = (positions.getX(0) + positions.getX(1)) / 2;
    expect(tailMidX).toBeCloseTo(1, 5);
  });

  it('clears all points and sets draw range count to 0 after fading out', () => {
    const camera = createTestCamera();
    const ribbon = createRibbon({
      look: 'glow',
      width: 0.5,
      colour: new Color('#ffffff'),
      fade: 1.0,
      maxPoints: 10,
    });

    ribbon.push(new Vector3(0, 0, 0));
    ribbon.push(new Vector3(1, 0, 0));
    ribbon.push(new Vector3(2, 0, 0));
    ribbon.update(0.1, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(12);

    // Advancing past 1.0 second fade drops all expired points
    ribbon.update(1.2, camera);
    expect(ribbon.mesh.geometry.drawRange.count).toBe(0);
  });

  it('sets whole path at once and configures draw range to 2 segments times 6 indices', () => {
    const camera = createTestCamera();
    const ribbon = createRibbon({
      look: 'glow',
      width: 0.8,
      colour: new Color('#ff4444'),
      fade: 3.0,
      maxPoints: 10,
    });

    const path = [new Vector3(0, 0, 0), new Vector3(5, 0, 0), new Vector3(10, 0, 0)];
    ribbon.setPath(path);
    ribbon.update(0, camera);

    expect(ribbon.mesh.geometry.drawRange.count).toBe(12);
  });

  it('straddles each point with vertex pairs perpendicular to the path in screen space', () => {
    const camera = createTestCamera();
    const ribbon = createRibbon({
      look: 'glow',
      width: 2.0,
      colour: new Color('#ffffff'),
      fade: 3.0,
      maxPoints: 5,
    });

    const path = [new Vector3(0, 0, 0), new Vector3(3, 0, 0), new Vector3(6, 0, 0)];
    ribbon.setPath(path);
    ribbon.update(0, camera);

    const positions = ribbon.mesh.geometry.getAttribute('position');
    const pathDir = new Vector3(1, 0, 0);

    for (let i = 0; i < path.length; i++) {
      const pt = assertDefined(path[i]);
      const v0 = new Vector3(positions.getX(2 * i), positions.getY(2 * i), positions.getZ(2 * i));
      const v1 = new Vector3(
        positions.getX(2 * i + 1),
        positions.getY(2 * i + 1),
        positions.getZ(2 * i + 1),
      );

      // Midpoint equals path point
      const mid = v0.clone().add(v1).multiplyScalar(0.5);
      expect(mid.x).toBeCloseTo(pt.x, 5);
      expect(mid.y).toBeCloseTo(pt.y, 5);
      expect(mid.z).toBeCloseTo(pt.z, 5);

      // Width matches style width
      expect(v0.distanceTo(v1)).toBeCloseTo(2.0, 5);

      // Offset is perpendicular to path direction
      const offset = v1.clone().sub(pt);
      expect(Math.abs(offset.dot(pathDir))).toBeLessThan(1e-6);
    }
  });

  it('scales the material alpha uniform when opacity changes', () => {
    const style: RibbonStyle = {
      look: 'glow',
      width: 0.5,
      colour: new Color('#ffffff'),
      alpha: 0.8,
      fade: 2.0,
      maxPoints: 5,
    };
    const ribbon = createRibbon(style);
    const material = ribbon.mesh.material as ShaderMaterial;
    const alphaUniform = assertDefined(material.uniforms.alpha);

    expect(alphaUniform.value).toBeCloseTo(0.8);
    expect(ribbon.opacity).toBe(1);

    ribbon.opacity = 0.5;
    expect(ribbon.opacity).toBe(0.5);
    expect(alphaUniform.value).toBeCloseTo(0.4);

    ribbon.opacity = 0;
    expect(ribbon.opacity).toBe(0);
    expect(alphaUniform.value).toBeCloseTo(0);
  });
});
