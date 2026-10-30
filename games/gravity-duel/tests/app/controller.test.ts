// @vitest-environment happy-dom
/**
 * Tests for Gravity Duel's controller: it wires a duel, a Kid match, a solo
 * docking run, and the Daily, challenge and micro-challenge runs the Hall
 * opens directly. The looks' own stage needs a real WebGL context that this
 * environment does not have, so `src/look/looks.ts` is replaced with a
 * minimal fake (a stage that renders nothing, a view that draws nothing):
 * everything downstream of it (the engine, the session, the screens, the
 * controller's own wiring) runs for real.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MicroBrief, RunInfo } from '@woodgrain-88/kit';
import { createFakeContext, type FakeContext } from '../../src/dev/fake-context.ts';
import type * as LooksModule from '../../src/look/looks.ts';
import { manifest } from '../../src/manifest.ts';
import { gravityDuel } from '../../src/module.ts';

vi.mock('../../src/look/looks.ts', async () => {
  const { Group } = await import('three');
  const actual = await vi.importActual<typeof LooksModule>('../../src/look/looks.ts');

  function fakeStage() {
    return {
      renderer: {},
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

function mountWith(run: RunInfo): { host: HTMLElement; fake: FakeContext; dispose: () => void } {
  const host = document.createElement('div');
  document.body.append(host);
  const fake = createFakeContext({
    manifest,
    host,
    run,
    kid: 'rosa',
    appearance: 'light',
    reducedMotion: true,
    switches: { left: 'B', right: 'B' },
    kids: 'human',
    chrome: {
      openPause: () => undefined,
      openSettings: () => undefined,
      openHowToPlay: () => undefined,
      backToHall: () => undefined,
      viewChanged: () => undefined,
    },
  });
  const instance = gravityDuel.mount(host, fake.context);
  return {
    host,
    fake,
    dispose: () => {
      instance.dispose();
      fake.dispose();
      host.remove();
    },
  };
}

describe('Gravity Duel controller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a normal run opens on the game menu, idling behind it', () => {
    const { fake, dispose } = mountWith({ mode: 'normal', seed: 1, channel: 'game-1' });
    expect(fake.log.view).toBe('menu');
    dispose();
  });

  it('wires a Kid match: picking a duel channel and "VS A KID" reaches play', () => {
    vi.useFakeTimers();
    const { host, fake, dispose } = mountWith({ mode: 'normal', seed: 1, channel: 'game-1' });

    host.querySelector<HTMLButtonElement>('[data-start="kid"]')?.click();
    expect(fake.log.view).toBe('play');
    expect(host.querySelector('.gd-prematch')).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    vi.advanceTimersByTime(2500);
    expect(host.querySelector('.gd-hud')).not.toBeNull();

    dispose();
  });

  it('wires a friend ("Versus") match from the same menu', () => {
    const { host, fake, dispose } = mountWith({ mode: 'normal', seed: 1, channel: 'game-1' });
    host.querySelector<HTMLButtonElement>('[data-start="friend"]')?.click();
    expect(fake.log.view).toBe('play');
    dispose();
  });

  it('wires a solo docking run, with one pre-match card and no vs', () => {
    const { host, fake, dispose } = mountWith({ mode: 'normal', seed: 1, channel: 'game-1' });

    const soloTab = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-mode]')).find(
      (button) => button.dataset.mode === 'solo',
    );
    soloTab?.click();
    host.querySelector<HTMLButtonElement>('[data-start="solo"]')?.click();

    expect(fake.log.view).toBe('play');
    expect(host.querySelectorAll('.gd-seat-card')).toHaveLength(1);
    dispose();
  });

  it('a Daily run skips the menu and starts straight into play', () => {
    const { fake, dispose } = mountWith({
      mode: 'daily',
      seed: 42,
      channel: 'game-1',
      dailyNumber: 7,
    });
    expect(fake.log.view).toBe('play');
    dispose();
  });

  it('a challenge-link run skips the menu and starts straight into play', () => {
    const { fake, dispose } = mountWith({
      mode: 'challenge',
      seed: 7,
      channel: 'game-4',
      challenge: { game: 'gravity-duel', channel: 'game-4', seed: 7, score: 5 },
    });
    expect(fake.log.view).toBe('play');
    dispose();
  });

  it('a micro-challenge run starts the match immediately, with no countdown', () => {
    const micro: MicroBrief = { id: 'dock-three', goal: 'Dock 3 pods', seconds: 45 };
    const { host, fake, dispose } = mountWith({
      mode: 'power-cycle-run',
      seed: 3,
      channel: 'game-14',
      micro,
    });
    expect(fake.log.view).toBe('play');
    // No cards, and the match is already running (not held behind a countdown).
    expect(host.querySelector('.gd-prematch')).toBeNull();
    dispose();
  });
});
