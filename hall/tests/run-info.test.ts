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

  it('resolves version following priority order for normal, daily and challenge runs and omits version when unsupported', () => {
    const { versions: _versions, ...unversionedManifest } = fakeManifest;

    // Normal run priority: ?version= on route > savedVersion > defaultVersion
    const normalWithParam = runFromParams(
      fakeManifest,
      new URLSearchParams('version=tall'),
      '',
      new Date(),
      'standard',
    );
    expect(normalWithParam.version).toBe('tall');

    const normalWithUnknownParam = runFromParams(
      fakeManifest,
      new URLSearchParams('version=not-a-version'),
      '',
      new Date(),
      'tall',
    );
    expect(normalWithUnknownParam.version).toBe('tall');

    const normalWithSaved = runFromParams(
      fakeManifest,
      new URLSearchParams(),
      '',
      new Date(),
      'tall',
    );
    expect(normalWithSaved.version).toBe('tall');

    const normalWithDefault = runFromParams(
      fakeManifest,
      new URLSearchParams(),
      '',
      new Date(),
      undefined,
    );
    expect(normalWithDefault.version).toBe('standard');

    // Daily run priority: ?version= on route > savedVersion > defaultVersion
    const dailyWithParam = runFromParams(
      fakeManifest,
      new URLSearchParams('mode=daily&version=tall'),
      '',
      new Date(),
      'standard',
    );
    expect(dailyWithParam.version).toBe('tall');

    const dailyWithUnknownParam = runFromParams(
      fakeManifest,
      new URLSearchParams('mode=daily&version=invalid-version'),
      '',
      new Date(),
      'tall',
    );
    expect(dailyWithUnknownParam.version).toBe('tall');

    const dailyWithDefault = runFromParams(
      fakeManifest,
      new URLSearchParams('mode=daily'),
      '',
      new Date(),
      undefined,
    );
    expect(dailyWithDefault.version).toBe('standard');

    // Challenge run priority: challenge.version > savedVersion > defaultVersion
    const challengeWithVersion: Challenge = {
      game: fakeManifest.id,
      channel: 'classic',
      seed: 1234,
      score: 50,
      version: 'tall',
    };
    const challengeHash = encodeChallenge(challengeWithVersion);
    const challengeParams = new URLSearchParams(
      challengeHash.slice(challengeHash.indexOf('?') + 1),
    );

    const challengeRun = runFromParams(
      fakeManifest,
      challengeParams,
      challengeHash,
      new Date(),
      'standard',
    );
    expect(challengeRun.version).toBe('tall');

    const challengeNoVersion: Challenge = {
      game: fakeManifest.id,
      channel: 'classic',
      seed: 1234,
      score: 50,
    };
    const hashNoVersion = encodeChallenge(challengeNoVersion);
    const paramsNoVersion = new URLSearchParams(
      hashNoVersion.slice(hashNoVersion.indexOf('?') + 1),
    );

    const challengeRunWithSaved = runFromParams(
      fakeManifest,
      paramsNoVersion,
      hashNoVersion,
      new Date(),
      'tall',
    );
    expect(challengeRunWithSaved.version).toBe('tall');

    // Game without versions gets no version property
    const unversionedNormal = runFromParams(
      unversionedManifest,
      new URLSearchParams('version=tall'),
      '',
      new Date(),
      'tall',
    );
    expect(unversionedNormal.version).toBeUndefined();
    expect('version' in unversionedNormal).toBe(false);

    const unversionedDaily = runFromParams(
      unversionedManifest,
      new URLSearchParams('mode=daily&version=tall'),
      '',
      new Date(),
      'tall',
    );
    expect(unversionedDaily.version).toBeUndefined();

    const unversionedChallenge = runFromParams(
      unversionedManifest,
      challengeParams,
      challengeHash,
      new Date(),
      'tall',
    );
    expect(unversionedChallenge.version).toBeUndefined();
  });
});
