/**
 * What the TV shows for a game that is not built yet: a little station
 * "slate" in the game's own label colours. The label's pattern drifts behind
 * a big emblem badge, the title sits on a lower-third band, a channel bug
 * blinks "SOON", and a tiny family-flavoured animation runs in the corner
 * (two dots chasing for duels, cells lighting for brain games, a ball arcing
 * for sports, stars streaming for arcade). A merged game's slate also says
 * which cartridge version the channel plays.
 *
 * It implements the same DemoHandle contract as a real game's demo(), so the
 * Den treats both the same way.
 */
import {
  findVersion,
  type Appearance,
  type CartridgeVersion,
  type DemoContext,
  type DemoHandle,
  type GameManifest,
} from '@woodgrain-88/kit';
import { counterDigits } from '../data/cycle.ts';
import { LABEL_FIELD, patternLayers } from './label.ts';

export const SLATE_SIZE = { width: 480, height: 360 } as const;

interface Painter {
  draw(context: CanvasRenderingContext2D, seconds: number, appearance: Appearance): void;
}

function emblemPath(manifest: GameManifest): Path2D {
  return new Path2D(manifest.label.motif ?? manifest.emblem);
}

/** `channel` is the Counter place showing it: the game's slot, or 31/32 for another version. */
function gameSlate(manifest: GameManifest, channel: number, version: CartridgeVersion | undefined): Painter {
  const { label } = manifest;
  const layers = patternLayers(label.pattern, manifest.id).map((layer) => ({ ...layer, path: new Path2D(layer.d) }));
  const emblem = emblemPath(manifest);
  const tile = { width: LABEL_FIELD.width, height: LABEL_FIELD.height };
  const familyPainter = familyAnimation(manifest);

  return {
    draw(context, seconds, appearance) {
      const { width, height } = SLATE_SIZE;
      context.fillStyle = label.paper;
      context.fillRect(0, 0, width, height);

      // The label pattern, scaled up and drifting slowly.
      const scale = 2.6;
      const drift = (seconds * 9) % (tile.width * scale);
      context.save();
      context.globalAlpha = 0.42;
      context.strokeStyle = label.ink;
      context.fillStyle = label.ink;
      context.lineCap = 'round';
      for (let ty = -1; ty * tile.height * scale < height + tile.height * scale; ty++) {
        for (let tx = -1; tx * tile.width * scale < width + tile.width * scale; tx++) {
          context.save();
          context.translate(tx * tile.width * scale + drift, ty * tile.height * scale + drift * 0.4);
          context.scale(scale, scale);
          context.translate(-LABEL_FIELD.x, -LABEL_FIELD.y);
          for (const layer of layers) {
            context.globalAlpha = 0.42 * layer.opacity;
            if (layer.kind === 'fill') context.fill(layer.path);
            else {
              context.lineWidth = layer.width;
              context.stroke(layer.path);
            }
          }
          context.restore();
        }
      }
      context.restore();

      // A soft vignette so the middle reads.
      const vignette = context.createRadialGradient(width / 2, height / 2, 60, width / 2, height / 2, 320);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      // The emblem badge, breathing gently.
      const bob = Math.sin(seconds * 1.6) * 4;
      const badge = { x: width / 2, y: 132 + bob, r: 78 };
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.beginPath();
      context.arc(badge.x + 5, badge.y + 7, badge.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = label.band;
      context.beginPath();
      context.arc(badge.x, badge.y, badge.r, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = 6;
      context.strokeStyle = label.bandText;
      context.stroke();
      context.save();
      context.translate(badge.x - 12 * 4.4, badge.y - 12 * 4.4);
      context.scale(4.4, 4.4);
      context.lineWidth = 1.8;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = label.bandText;
      context.stroke(emblem);
      context.restore();

      familyPainter(context, seconds, label.bandText, label.band);

      // Lower third: the title on the band colour.
      context.fillStyle = label.band;
      context.fillRect(0, 248, width, 66);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(0, 312, width, 3);
      context.fillStyle = label.bandText;
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      context.font = 'italic 700 40px Fraunces Variable, Fraunces, Georgia, serif';
      context.fillText(manifest.title, width / 2, 290, width - 40);
      context.font = '600 15px Atkinson Hyperlegible Next Variable, system-ui, sans-serif';
      context.fillText(manifest.tagline, width / 2, 308, width - 40);

      // Channel bug and a blinking "SOON" pill.
      context.textAlign = 'left';
      context.font = '800 22px Big Shoulders Display Variable, Arial Narrow, sans-serif';
      context.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(context, 16, 16, 74, 32, 8);
      context.fill();
      context.fillStyle = '#fff6e6';
      context.fillText(`CH ${counterDigits(channel)}`, 26, 40);
      const on = Math.floor(seconds * 1.4) % 2 === 0;
      context.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(context, width - 106, 16, 90, 32, 16);
      context.fill();
      context.fillStyle = on ? '#ff5a3c' : 'rgba(255,90,60,0.35)';
      context.beginPath();
      context.arc(width - 88, 32, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff6e6';
      context.fillText('SOON', width - 74, 40);

      // Which cartridge version this channel plays, under the channel bug.
      if (version) {
        const text = `${version.label.toUpperCase()} VERSION`;
        context.font = '800 19px Big Shoulders Display Variable, Arial Narrow, sans-serif';
        const pill = context.measureText(text).width + 24;
        context.fillStyle = label.band;
        roundRect(context, 16, 56, pill, 30, 15);
        context.fill();
        context.fillStyle = label.bandText;
        context.fillText(text, 28, 77);
      }

      if (appearance === 'dark') {
        context.fillStyle = 'rgba(10,6,20,0.12)';
        context.fillRect(0, 0, width, height);
      }
    },
  };
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath();
  context.roundRect(x, y, w, h, r);
}

type FamilyPainter = (context: CanvasRenderingContext2D, seconds: number, ink: string, paper: string) => void;

/** A small looping motion in the corner that hints at what kind of game it is. */
function familyAnimation(manifest: GameManifest): FamilyPainter {
  const corner = { x: 404, y: 196 };
  const panel = (context: CanvasRenderingContext2D, paper: string, ink: string) => {
    context.fillStyle = paper;
    roundRect(context, corner.x - 46, corner.y - 34, 92, 68, 10);
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = ink;
    context.stroke();
  };
  switch (manifest.family) {
    case 'duels':
      return (context, seconds, ink, paper) => {
        panel(context, paper, ink);
        for (let i = 0; i < 2; i++) {
          const a = seconds * 2.2 + i * Math.PI;
          context.fillStyle = i === 0 ? ink : '#ff5a3c';
          context.beginPath();
          context.arc(corner.x + Math.cos(a) * 28, corner.y + Math.sin(a * 1.3) * 18, 6, 0, Math.PI * 2);
          context.fill();
        }
      };
    case 'brain':
      return (context, seconds, ink, paper) => {
        panel(context, paper, ink);
        const lit = Math.floor(seconds * 3) % 9;
        for (let i = 0; i < 9; i++) {
          context.fillStyle = i === lit ? '#ff5a3c' : ink;
          context.globalAlpha = i === lit ? 1 : 0.35;
          context.fillRect(corner.x - 27 + (i % 3) * 19, corner.y - 26 + Math.floor(i / 3) * 18, 15, 14);
        }
        context.globalAlpha = 1;
      };
    case 'sports':
      return (context, seconds, ink, paper) => {
        panel(context, paper, ink);
        const t = (seconds * 0.8) % 1;
        const x = corner.x - 34 + t * 68;
        const y = corner.y + 22 - Math.sin(t * Math.PI) * 44;
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(corner.x - 40, corner.y + 26);
        context.lineTo(corner.x + 40, corner.y + 26);
        context.stroke();
        context.fillStyle = '#ff5a3c';
        context.beginPath();
        context.arc(x, y, 6, 0, Math.PI * 2);
        context.fill();
      };
    case 'arcade':
      return (context, seconds, ink, paper) => {
        panel(context, paper, ink);
        context.fillStyle = ink;
        for (let i = 0; i < 9; i++) {
          const speed = 40 + (i % 3) * 25;
          const x = corner.x + 40 - ((seconds * speed + i * 31) % 80);
          context.fillRect(x, corner.y - 26 + i * 6.5, 3 + (i % 3), 2);
        }
        context.fillStyle = '#ff5a3c';
        context.beginPath();
        context.moveTo(corner.x - 30, corner.y - 6);
        context.lineTo(corner.x - 14, corner.y);
        context.lineTo(corner.x - 30, corner.y + 6);
        context.fill();
      };
  }
}

function createPainterDemo(host: HTMLElement, painter: Painter, context: DemoContext): DemoHandle {
  const surface = document.createElement('canvas');
  surface.width = SLATE_SIZE.width;
  surface.height = SLATE_SIZE.height;
  surface.className = 'demo-surface';
  host.append(surface);
  const drawing = surface.getContext('2d');
  let appearance = context.appearance;
  let frame: number | null = null;
  const started = performance.now();
  // Under reduced motion the slate holds still on a pleasant frame.
  const stillAt = 1.2;

  const render = (now: number) => {
    frame = null;
    if (!drawing) return;
    const seconds = context.reducedMotion ? stillAt : (now - started) / 1000;
    painter.draw(drawing, seconds, appearance);
    if (!context.reducedMotion) frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);

  return {
    surface,
    setAppearance(next) {
      appearance = next;
      if (context.reducedMotion && drawing) painter.draw(drawing, stillAt, appearance);
    },
    resize() {
      // The slate always draws at its own size; the CRT scales it.
    },
    pause() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
    resume() {
      frame ??= requestAnimationFrame(render);
    },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      surface.remove();
    },
  };
}

/** The coming-soon slate; `channel` defaults to the game's own slot. */
export function slateDemo(
  host: HTMLElement,
  manifest: GameManifest,
  context: DemoContext,
  channel = manifest.slot,
): DemoHandle {
  return createPainterDemo(host, gameSlate(manifest, channel, findVersion(manifest, context.version)), context);
}
