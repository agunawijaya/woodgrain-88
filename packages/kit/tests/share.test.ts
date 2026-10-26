/**
 * Tests for challenge link encoding, decoding, FNV-1a checksum stability,
 * self-contained SVG share cards and clipboard/download helpers.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  challengeChecksum,
  copyText,
  decodeChallenge,
  BLOB_URL_LIFETIME_MS,
  downloadText,
  encodeChallenge,
  renderShareCard,
  type Challenge,
} from '../src/share.ts';

describe('challengeChecksum, encodeChallenge and decodeChallenge', () => {
  const sample: Challenge = {
    game: 'tank-duel',
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
      `#/play/tank-duel?mode=challenge&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
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
    const base = '#/play/tank-duel?mode=challenge&ch=ricochet-alley';
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
        `#/play/tank-duel?mode=challenge&ch=Ricochet_Alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
    expect(decodeChallenge(`${base}&seed=4294967296&beat=14&sig=${sig}`)).toBeNull();
    expect(decodeChallenge(`${base}&seed=-1&beat=14&sig=${sig}`)).toBeNull();
    expect(
      decodeChallenge(
        `#/games/tank-duel?mode=challenge&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
    expect(
      decodeChallenge(
        `#/play/tank-duel?mode=daily&ch=ricochet-alley&seed=28491032&beat=14&sig=${sig}`,
      ),
    ).toBeNull();
  });

  it('encodes and decodes a challenge with a version, fails when ver is modified, and preserves legacy checksum without a version', () => {
    const versioned: Challenge = {
      game: 'lane-hopper',
      channel: 'classic',
      seed: 12345,
      score: 10,
      version: 'rabbit',
    };

    const encoded = encodeChallenge(versioned);
    expect(encoded).toContain('&ver=rabbit');
    expect(encoded).toBe(
      `#/play/lane-hopper?mode=challenge&ch=classic&seed=12345&beat=10&ver=rabbit&sig=${challengeChecksum(versioned)}`,
    );

    const decoded = decodeChallenge(encoded);
    expect(decoded).toEqual(versioned);

    // Changing ver in the link fails verification
    const tamperedVer = encoded.replace('&ver=rabbit', '&ver=chicken');
    expect(decodeChallenge(tamperedVer)).toBeNull();

    // A challenge without a version decodes without one
    const unversioned: Challenge = {
      game: 'tank-duel',
      channel: 'ricochet-alley',
      seed: 28491032,
      score: 14,
    };
    const unversionedEncoded = encodeChallenge(unversioned);
    expect(unversionedEncoded).not.toContain('&ver=');
    const unversionedDecoded = decodeChallenge(unversionedEncoded);
    expect(unversionedDecoded).toEqual(unversioned);
    expect(unversionedDecoded?.version).toBeUndefined();

    // Link and checksum are exactly what they were before versions existed
    // (compute expected checksum from canonical text: game|channel|seed|score)
    const canonicalText = `woodgrain-88/challenge/${unversioned.game}|${unversioned.channel}|${unversioned.seed}|${unversioned.score}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < canonicalText.length; i++) {
      hash ^= canonicalText.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const expectedSig = (hash >>> 0).toString(36).padStart(6, '0').slice(-6);
    expect(challengeChecksum(unversioned)).toBe(expectedSig);
    expect(unversionedEncoded).toBe(
      `#/play/tank-duel?mode=challenge&ch=ricochet-alley&seed=28491032&beat=14&sig=${expectedSig}`,
    );
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

  it('triggers a temporary anchor download and revokes the object URL once it has been read', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadText('card.svg', '<svg></svg>', 'image/svg+xml');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(BLOB_URL_LIFETIME_MS);
    expect(revokeSpy).toHaveBeenCalledWith('blob:test-url');

    vi.useRealTimers();
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
