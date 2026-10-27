/**
 * Tests for tabletop camera framing and projection: NDC bounds fitting,
 * symmetry and fairness across the table, top inset headroom, tilt elevation,
 * and unitsPerPixel scaling.
 */
import { describe, expect, it } from 'vitest';
import { MathUtils, Vector3 } from 'three';
import { createTableCamera, frameTable, unitsPerPixel, type TableFraming } from '../src/camera.ts';

describe('frameTable', () => {
  it('projects all four ground corners and far raised corners inside NDC [-1, 1] across aspects', () => {
    const framing: TableFraming = {
      width: 40,
      depth: 30,
      tilt: 60,
      height: 5,
      margin: 0.08,
    };
    const camera = createTableCamera();
    const aspects = [16 / 9, 4 / 3, 9 / 16];

    const corners = [
      new Vector3(-framing.width / 2, 0, -framing.depth / 2),
      new Vector3(framing.width / 2, 0, -framing.depth / 2),
      new Vector3(-framing.width / 2, 0, framing.depth / 2),
      new Vector3(framing.width / 2, 0, framing.depth / 2),
      new Vector3(-framing.width / 2, framing.height, -framing.depth / 2),
      new Vector3(framing.width / 2, framing.height, -framing.depth / 2),
    ];

    for (const aspect of aspects) {
      frameTable(camera, framing, aspect);
      camera.updateMatrixWorld();

      for (const corner of corners) {
        const ndc = corner.clone().project(camera);
        expect(ndc.x).toBeGreaterThanOrEqual(-1);
        expect(ndc.x).toBeLessThanOrEqual(1);
        expect(ndc.y).toBeGreaterThanOrEqual(-1);
        expect(ndc.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('projects left and right ground corners to symmetric NDC x coordinates for fairness', () => {
    const framing: TableFraming = {
      width: 50,
      depth: 35,
      tilt: 58,
      height: 4,
      margin: 0.1,
    };
    const camera = createTableCamera();
    frameTable(camera, framing, 16 / 9);
    camera.updateMatrixWorld();

    const farLeft = new Vector3(-framing.width / 2, 0, -framing.depth / 2).project(camera);
    const farRight = new Vector3(framing.width / 2, 0, -framing.depth / 2).project(camera);
    const nearLeft = new Vector3(-framing.width / 2, 0, framing.depth / 2).project(camera);
    const nearRight = new Vector3(framing.width / 2, 0, framing.depth / 2).project(camera);

    expect(Math.abs(farLeft.x + farRight.x)).toBeLessThan(1e-9);
    expect(Math.abs(nearLeft.x + nearRight.x)).toBeLessThan(1e-9);
    expect(Math.abs(farLeft.x)).toBeGreaterThan(0.1);
  });

  it('keeps all framed points below the top inset while preserving fit', () => {
    const topInset = 0.15;
    const framing: TableFraming = {
      width: 44,
      depth: 28,
      tilt: 62,
      height: 6,
      margin: 0.05,
      topInset,
    };
    const camera = createTableCamera();
    const maxY = 1 - 2 * topInset;

    const corners = [
      new Vector3(-framing.width / 2, 0, -framing.depth / 2),
      new Vector3(framing.width / 2, 0, -framing.depth / 2),
      new Vector3(-framing.width / 2, 0, framing.depth / 2),
      new Vector3(framing.width / 2, 0, framing.depth / 2),
      new Vector3(-framing.width / 2, framing.height, -framing.depth / 2),
      new Vector3(framing.width / 2, framing.height, -framing.depth / 2),
    ];

    for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
      frameTable(camera, framing, aspect);
      camera.updateMatrixWorld();

      for (const corner of corners) {
        const ndc = corner.clone().project(camera);
        expect(ndc.y).toBeLessThanOrEqual(maxY + 1e-9);
        expect(ndc.y).toBeGreaterThanOrEqual(-1);
        expect(ndc.x).toBeGreaterThanOrEqual(-1);
        expect(ndc.x).toBeLessThanOrEqual(1);
      }
    }
  });

  it('aligns camera view direction elevation with framing tilt for tilts 55 and 65', () => {
    const camera = createTableCamera();
    const dir = new Vector3();

    for (const tilt of [55, 65]) {
      const framing: TableFraming = {
        width: 30,
        depth: 20,
        tilt,
        height: 3,
        margin: 0.1,
      };
      frameTable(camera, framing, 16 / 9);
      camera.updateMatrixWorld();
      camera.getWorldDirection(dir);

      // In three.js camera space, looking down towards table origin means -dir.y is elevation sine
      const elevation = MathUtils.radToDeg(Math.asin(-dir.y));
      expect(Math.abs(elevation - tilt)).toBeLessThan(1e-6);
      expect(Math.abs(dir.x)).toBeLessThan(1e-9);
    }
  });

  it('enlarges frustum when margin increases and halves unitsPerPixel when viewport height doubles', () => {
    const baseFraming: TableFraming = {
      width: 40,
      depth: 30,
      tilt: 60,
      height: 4,
      margin: 0.05,
    };
    const wideFraming: TableFraming = {
      ...baseFraming,
      margin: 0.25,
    };

    const cameraBase = createTableCamera();
    frameTable(cameraBase, baseFraming, 16 / 9);

    const cameraWide = createTableCamera();
    frameTable(cameraWide, wideFraming, 16 / 9);

    const baseHeight = cameraBase.top - cameraBase.bottom;
    const wideHeight = cameraWide.top - cameraWide.bottom;
    const baseWidth = cameraBase.right - cameraBase.left;
    const wideWidth = cameraWide.right - cameraWide.left;

    expect(wideHeight).toBeGreaterThan(baseHeight);
    expect(wideWidth).toBeGreaterThan(baseWidth);

    const upp500 = unitsPerPixel(cameraBase, 500);
    const upp1000 = unitsPerPixel(cameraBase, 1000);
    expect(upp1000).toBeCloseTo(upp500 / 2, 9);
  });
});
