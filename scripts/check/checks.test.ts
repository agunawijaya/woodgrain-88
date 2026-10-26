import { describe, expect, it } from 'vitest';
import { findNames } from './names.ts';
import { checkProvenance } from './provenance.ts';
import { checkRaster } from './raster.ts';

describe('raster check', () => {
  it('allows screenshots in media folders and refuses images anywhere else', () => {
    const problems = checkRaster([
      'docs/media/hero/a-den-day.png',
      'games/tank-duel/docs/media/shot.png',
      'hall/src/logo.png',
      'packages/kit/src/icon.svg',
    ]);
    expect(problems.map((p) => p.file)).toEqual(['hall/src/logo.png']);
  });
});

describe('provenance check', () => {
  it('refuses reference folders, research and cartridge images', () => {
    const problems = checkProvenance([
      'src/01_UFO.asm',
      'original/cart.bin',
      'research/dossiers/00.md',
      'hall/x.bin',
      'README.md',
    ]);
    expect(problems.map((p) => p.file)).toEqual([
      'src/01_UFO.asm',
      'original/cart.bin',
      'original/cart.bin',
      'research/dossiers/00.md',
      'hall/x.bin',
    ]);
  });
});

describe('names check', () => {
  it('finds original titles and brands as whole words only', () => {
    expect(findNames('A Freeway clone')).toEqual(['Freeway']);
    expect(findNames('Air-Sea Battle and Space War')).toEqual(['Air-Sea Battle', 'Space War']);
    expect(findNames('surrounding walls, a combative bot, the outlaw town')).toEqual([]);
  });
});
