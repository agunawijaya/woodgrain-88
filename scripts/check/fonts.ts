/**
 * Fonts are self-hosted and open (CLAUDE.md rule 4): every font package the
 * Hall depends on must be on this list of OFL or Apache licensed families.
 */
import { readRepoFile, type Problem } from './files.ts';

const OPEN_FONTS = new Set([
  '@fontsource-variable/fraunces',
  '@fontsource-variable/atkinson-hyperlegible-next',
  '@fontsource-variable/big-shoulders-display',
  '@fontsource/patrick-hand',
]);

export function checkFonts(): Problem[] {
  const manifest = JSON.parse(readRepoFile('hall/package.json')) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(manifest.dependencies ?? {})
    .filter((name) => name.startsWith('@fontsource') && !OPEN_FONTS.has(name))
    .map((name) => ({
      file: 'hall/package.json',
      message: `font ${name} is not on the open-licence list`,
    }));
}
