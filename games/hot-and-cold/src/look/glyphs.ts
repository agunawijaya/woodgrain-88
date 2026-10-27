/**
 * Numerals and short labels drawn into textures at run time with the
 * collection's own self-hosted fonts: nothing is loaded but the font the page
 * already has. If the font is still on its way, the glyph is drawn with the
 * fallback at once and drawn again, in place, when the font arrives.
 */
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

export const DISPLAY_FONT = '"Big Shoulders Display Variable", "Arial Narrow", sans-serif';
export const SERIF_FONT = '"Fraunces Variable", Georgia, serif';
export const LEGIBLE_FONT = '"Atkinson Hyperlegible Next Variable", Verdana, sans-serif';

export interface GlyphStyle {
  /** CSS font shorthand without the size, e.g. `800 ${DISPLAY_FONT}`. */
  readonly font: string;
  /** Glyph height as a fraction of the texture. */
  readonly scale: number;
  /** Texels per side. */
  readonly size: number;
  /** Paints the glyph; the context is already set up with font, alignment and a centred origin. */
  paint(context: CanvasRenderingContext2D, text: string, fontSize: number): void;
  /** True for a colour picture; false for a mask (emissive or alpha), kept linear. */
  readonly colour: boolean;
}

export function createGlyphTexture(text: string, style: GlyphStyle): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = style.size;
  canvas.height = style.size;
  const texture = new CanvasTexture(canvas);
  if (style.colour) texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 8;

  const draw = () => {
    const context = canvas.getContext('2d');
    if (!context) return;
    const fontSize = style.size * style.scale;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, style.size, style.size);
    context.translate(style.size / 2, style.size / 2);
    context.font = withSize(style.font, fontSize);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    style.paint(context, text, fontSize);
    texture.needsUpdate = true;
  };
  draw();
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.load(withSize(style.font, 64), text).then(draw, () => undefined);
  }
  return texture;
}

/** Puts the pixel size into a "weight family" shorthand: `800 Family` becomes `800 120px Family`. */
function withSize(font: string, fontSize: number): string {
  const match = /^(\d{3}|normal|bold)\s+(.*)$/.exec(font);
  return match ? `${match[1]} ${fontSize}px ${match[2]}` : `${fontSize}px ${font}`;
}
