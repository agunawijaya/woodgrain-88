/**
 * Tests for challenge link encoding, decoding, FNV-1a checksum stability,
 * self-contained SVG share cards and clipboard/download helpers.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  challengeChecksum,
  copyText,
  decodeChallenge,
  downloadText,
  encodeChallenge,
  renderShareCard,
  type Challenge,
} from '../src/share.ts';

describe('challengeChecksum, encodeChallenge and decodeChallenge', () => {
  const sample: Challenge = {
    game: 'paint-tanks',
    channel: 'ricochet-alley',
    seed: 28491032,
    score: 14,
  };

  it('produces a deterministic 6-character base-36 checksum', () => {
    const first = challengeChecksum(sample);
    const second = challengeChecksum({ ...sample });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-z]{6}$/);
    expect(challengeChecksum({ ...sample, score: 15 })).not.toBe(first);
    expect(challengeChecksum({ ...sample, seed: 28491033 })).not.toBe(first);
  });

  it('round-trips a challenge through encodeChallenge and decodeChallenge', () => {
    const encoded = encodeChallenge(sample);
    const sig = challengeChecksum(sample);
    expect(encoded).toBe(
      `#/play/paint-tanks?mode=challenge&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
    );
    expect(decodeChallenge(encoded)).toEqual(sample);
    expect(decodeChallenge(encoded.slice(1))).toEqual(sample);
    expect(decodeChallenge(`${encoded}&extra=ignored`)).toEqual(sample);
  });

  it('supports negative and decimal scores within range', () => {
    const golf: Challenge = {
      game: 'sunny-links',
      channel: 'back-nine',
      seed: 0,
      score: -3.5,
    };
    expect(decodeChallenge(encodeChallenge(golf))).toEqual(golf);
  });

  it('returns null when score, seed, parameters, ids or path are invalid or tampered', () => {
    const sig = challengeChecksum(sample);
    const base = '#/play/paint-tanks?mode=challenge&ch=ricochet-alley';
    expect(decodeChallenge(`${base}&seed=28491032&beat=15&sig=${sig}`)).toBeNull();
    expect(decodeChallenge(`${base}&seed=28491033&beat=14&sig=${sig}`)).toBeNull();
    expect(decodeChallenge(`${base}&seed=28491032&beat=14`)).toBeNull();
    expect(
      decodeChallenge(
        `#/play/Paint_Tanks?mode=challenge&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
    expect(
      decodeChallenge(
        `#/play/paint-tanks?mode=challenge&ch=Ricochet_Alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
    expect(decodeChallenge(`${base}&seed=4294967296&beat=14&sig=${sig}`)).toBeNull();
    expect(decodeChallenge(`${base}&seed=-1&beat=14&sig=${sig}`)).toBeNull();
    expect(
      decodeChallenge(
        `#/games/paint-tanks?mode=challenge&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
    expect(
      decodeChallenge(
        `#/play/paint-tanks?mode=daily&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
  });
});

describe('renderShareCard', () => {
  it('renders a 1200x630 SVG with escaped text, no <image, and distinct light/dark palettes', () => {
    const light = renderShareCard({
      title: 'Paint & <Tanks>',
      subtitle: 'Channel: "Ricochet" \'Alley\'',
      lines: ['Score: 14 <best>', 'Beat & share', 'Seed #42', 'Line 4', 'Extra line ignored'],
      accent: '#d9534f',
      appearance: 'light',
      emblem: 'M2 2h20v20H2z',
    });

    const dark = renderShareCard({
      title: 'Paint & <Tanks>',
      subtitle: 'Channel: "Ricochet" \'Alley\'',
      lines: ['Score: 14 <best>', 'Beat & share'],
      accent: '#d9534f',
      appearance: 'dark',
    });

    expect(light.startsWith('<svg')).toBe(true);
    expect(light).toContain('width="1200"');
    expect(light).toContain('height="630"');
    expect(light).toContain('viewBox="0 0 1200 630"');
    expect(light).toContain('font-family="system-ui, -apple-system, \'Segoe UI\', sans-serif"');
    expect(light).toContain('Paint &amp; &lt;Tanks&gt;');
    expect(light).toContain('Channel: &quot;Ricochet&quot; &apos;Alley&apos;');
    expect(light).toContain('Score: 14 &lt;best&gt;');
    expect(light).toContain('Line 4');
    expect(light).not.toContain('Extra line ignored');
    expect(light).toContain('<path d="M2 2h20v20H2z" fill="none" stroke="#d9534f"');
    expect(light).toContain('stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"');
    expect(light).toContain("Woodgrain '88");
    expect(light).not.toContain('<image');
    expect(light).not.toContain('href=');
    expect(dark.startsWith('<svg')).toBe(true);
    expect(dark).not.toBe(light);
  });
});

describe('copyText and downloadText', () => {
  it('copies text via navigator.clipboard and returns false on error', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');

    writeText.mockRejectedValueOnce(new Error('denied'));
    expect(await copyText('hello')).toBe(false);
  });

  it('triggers a temporary anchor download and revokes the object URL', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadText('card.svg', '<svg></svg>', 'image/svg+xml');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:test-url');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
