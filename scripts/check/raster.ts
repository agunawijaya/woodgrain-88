/**
 * Zero raster assets (CLAUDE.md rule 4): images live only in media folders,
 * where screenshots for the docs are allowed.
 */
import type { Problem } from './files.ts';

const RASTER = /\.(png|jpe?g|gif|webp|bmp|ico|avif|tiff?)$/i;
const MEDIA_FOLDERS = [/^docs\/media\//, /^games\/[^/]+\/docs\/media\//];

export function checkRaster(files: readonly string[]): Problem[] {
  return files
    .filter((file) => RASTER.test(file) && !MEDIA_FOLDERS.some((folder) => folder.test(file)))
    .map((file) => ({ file, message: 'raster image outside a media folder' }));
}
