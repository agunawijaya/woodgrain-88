/**
 * Tests for runFromParams: daily run derivation, challenge hash decoding,
 * checksum verification and channel fallback behaviour.
 */
import type { Challenge } from '@woodgrain-88/kit';
import { dailyNumber, dailySeed, encodeChallenge } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { runFromParams } from '../src/play/run-info.ts';
import { fakeManifest } from './fixtures/fake-game.ts';

const noDailyManifest = { ...fakeManifest, supports: { ...fakeManifest.supports, daily: false } };

describe('run parameter setup', () => {
  it('derives daily run details when supported and falls back to normal when unsupported', () => {
    const fixedDate = new Date('2026-10-25T12:00:00.000Z');
    const dailyParams = new URLSearchParams('mode=daily');

    const dailyRun = runFromParams(fakeManifest, dailyParams, '', fixedDate);
    expect(dailyRun.mode).toBe('daily');
    expect(dailyRun.seed).toBe(dailySeed(fakeManifest.id, fixedDate));
    expect(dailyRun.dailyNumber).toBe(dailyNumber(fixedDate));

    const nonDailyRun = runFromParams(noDailyManifest, dailyParams, '', fixedDate);
    expect(nonDailyRun.mode).toBe('normal');
    expect(nonDailyRun.dailyNumber).toBeUndefined();
  });

  it('decodes verified challenge hashes and falls back to normal when the score is modified', () => {
    const challenge: Challenge = {
      game: fakeManifest.id,
      channel: 'fast',
      seed: 98765,
      score: 42,
    };
    const validHash = encodeChallenge(challenge);
    const queryIndex = validHash.indexOf('?');
    const validParams = new URLSearchParams(queryIndex >= 0 ? validHash.slice(queryIndex + 1) : '');

    const challengeRun = runFromParams(fakeManifest, validParams, validHash);
    expect(challengeRun.mode).toBe('challenge');
    expect(challengeRun.seed).toBe(98765);
    expect(challengeRun.channel).toBe('fast');
    expect(challengeRun.challenge?.score).toBe(42);

    const tamperedHash = validHash.replace('beat=42', 'beat=99');
    expect(tamperedHash).not.toBe(validHash);
    const tamperedQueryIndex = tamperedHash.indexOf('?');
    const tamperedParams = new URLSearchParams(
      tamperedQueryIndex >= 0 ? tamperedHash.slice(tamperedQueryIndex + 1) : '',
    );

    const tamperedRun = runFromParams(fakeManifest, tamperedParams, tamperedHash);
    expect(tamperedRun.mode).toBe('normal');
    expect(tamperedRun.challenge).toBeUndefined();
  });

  it('keeps known channels and falls back to the first available channel for unknown values', () => {
    const knownParams = new URLSearchParams('ch=fast');
    const knownRun = runFromParams(fakeManifest, knownParams, '');
    expect(knownRun.channel).toBe('fast');

    const unknownParams = new URLSearchParams('ch=unregistered');
    const fallbackRun = runFromParams(fakeManifest, unknownParams, '');
    expect(fallbackRun.channel).toBe('classic');

    const emptyParams = new URLSearchParams();
    const defaultRun = runFromParams(fakeManifest, emptyParams, '');
    expect(defaultRun.channel).toBe('classic');
  });
});
