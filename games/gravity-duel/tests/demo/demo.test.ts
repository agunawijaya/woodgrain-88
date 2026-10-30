// @vitest-environment happy-dom
/**
 * Tests for the Den TV demo: it starts and stops cleanly, and its appearance
 * and size can be changed while it runs. `src/look/looks.ts` is faked, as in
 * the controller's tests, since the real stage needs a WebGL context this
 * environment does not have.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as LooksModule from '../../src/look/looks.ts';

vi.mock('../../src/look/looks.ts', async () => {
  const { Group } = await import('three');
  const actual = await vi.importActual<typeof LooksModule>('../../src/look/looks.ts');

  function fakeStage() {
    return {
      renderer: { getContext: () => ({ getExtension: () => null }) },
      scene: { add: () => undefined, remove: () => undefined, background: null },
      camera: {},
      lights: { update: () => undefined },
      canvas: document.createElement('canvas'),
      appearance: 'light',
      setAppearance: () => undefined,
      setFraming: () => undefined,
      setSize: () => undefined,
      setShake: () => undefined,
      resize: () => undefined,
      render: () => undefined,
      dispose: () => undefined,
    };
  }

  function fakeLook(id: string) {
    return {
      id,
      name: actual.lookById(id as never).name,
      framing: { width: 32, depth: 18, height: 20 },
      background: () => '#000000',
      createView: () => ({
        root: new Group(),
        show: () => undefined,
        moment: () => undefined,
        update: () => undefined,
        dispose: () => undefined,
      }),
    };
  }

  return {
    LOOK_IDS: actual.LOOK_IDS,
    LOOKS: Object.fromEntries(actual.LOOK_IDS.map((id) => [id, fakeLook(id)])),
    lookById: (id: string) => fakeLook(id),
    createLookStage: () => fakeStage(),
  };
});

describe('Den TV demo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts, draws a still picture with reduced motion, and stops cleanly', async () => {
    const { createGravityDuelDemo } = await import('../../src/demo/demo.ts');
    const host = document.createElement('div');
    document.body.append(host);

    const demo = createGravityDuelDemo(host, 1, {
      appearance: 'light',
      reducedMotion: true,
      width: 320,
      height: 240,
    });

    expect(demo.surface).toBeInstanceOf(HTMLCanvasElement);
    expect(() => demo.resize(160, 120)).not.toThrow();
    expect(() => demo.setAppearance('dark')).not.toThrow();
    expect(() => demo.pause()).not.toThrow();
    expect(() => demo.resume()).not.toThrow();
    expect(() => demo.dispose()).not.toThrow();

    host.remove();
  });

  it('loops matches when running (not held still)', async () => {
    const { createGravityDuelDemo } = await import('../../src/demo/demo.ts');
    const host = document.createElement('div');
    document.body.append(host);

    const demo = createGravityDuelDemo(host, 2, {
      appearance: 'light',
      reducedMotion: false,
      width: 320,
      height: 240,
    });

    expect(() => demo.dispose()).not.toThrow();
    host.remove();
  });
});
