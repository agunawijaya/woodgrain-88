/**
 * The tabletop camera: orthographic and tilted, so a tank at the back of the
 * table is exactly as big and as readable as one at the front. Perspective
 * would hand the player nearest the camera a bigger target; a duel has to be
 * fair, so every distance on the table reads the same on screen.
 */
import { MathUtils, OrthographicCamera, Vector3 } from 'three';

export interface TableFraming {
  /** Width (x) and depth (z) of the area that must stay fully visible, centred on the origin. */
  readonly width: number;
  readonly depth: number;
  /** The view's elevation above the table in degrees; 55–65 gives the tabletop look. */
  readonly tilt: number;
  /** The tallest thing near the far edge (walls, aircraft), so its top is never cut off. */
  readonly height: number;
  /** Extra room around the area, as a fraction of its size. */
  readonly margin: number;
  /** Fraction of the screen kept free at the top for the score plates. */
  readonly topInset?: number;
  /** Height of the layer being framed: 0 for the ground, the flying height for aircraft. */
  readonly elevation?: number;
}

const CAMERA_DISTANCE = 120;

export function createTableCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, CAMERA_DISTANCE * 3);
  return camera;
}

/**
 * Places the camera above the table at the framing's tilt and sizes its frustum so the whole area
 * fits the viewport's aspect, centred below the top inset.
 */
export function frameTable(
  camera: OrthographicCamera,
  framing: TableFraming,
  aspect: number,
): void {
  const tilt = MathUtils.degToRad(framing.tilt);
  const toCamera = new Vector3(0, Math.sin(tilt), Math.cos(tilt));
  const elevation = framing.elevation ?? 0;
  camera.position
    .copy(toCamera.multiplyScalar(CAMERA_DISTANCE))
    .setY(camera.position.y + elevation);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, elevation, 0);

  // In view space a table point (x, h, z) lands at y = h·cos(tilt) − z·sin(tilt): the near edge
  // sits lowest, the far edge's tallest things highest.
  const halfDepthOnScreen = (framing.depth / 2) * Math.sin(tilt);
  const top = halfDepthOnScreen + framing.height * Math.cos(tilt);
  const bottom = -halfDepthOnScreen;
  const grow = 1 + framing.margin * 2;
  const inset = framing.topInset ?? 0;

  const contentHeight = (top - bottom) * grow;
  const contentWidth = framing.width * grow;
  const viewHeight = Math.max(contentHeight / (1 - inset), contentWidth / aspect);
  const viewWidth = viewHeight * aspect;

  const contentMiddle = (top + bottom) / 2;
  const frustumBottom = contentMiddle - (viewHeight * (1 - inset)) / 2;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.bottom = frustumBottom;
  camera.top = frustumBottom + viewHeight;
  camera.updateProjectionMatrix();
}

/** World units per CSS pixel at the current framing, for sizing screen-space effects. */
export function unitsPerPixel(camera: OrthographicCamera, viewportHeight: number): number {
  return (camera.top - camera.bottom) / camera.zoom / Math.max(1, viewportHeight);
}
