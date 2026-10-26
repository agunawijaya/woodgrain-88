/**
 * The reference folders never leave this machine (CLAUDE.md rule 2): nothing
 * under original/, src/ or research/ may be published, and no cartridge image
 * may be published anywhere.
 */
import type { Problem } from './files.ts';

const PRIVATE_FOLDERS = /^(original|src|research)\//;
const CARTRIDGE_IMAGE = /\.(bin|a26|rom)$/i;

export function checkProvenance(files: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  for (const file of files) {
    if (PRIVATE_FOLDERS.test(file)) {
      problems.push({ file, message: 'reference or research file would be published' });
    }
    if (CARTRIDGE_IMAGE.test(file))
      problems.push({ file, message: 'cartridge image would be published' });
  }
  return problems;
}
