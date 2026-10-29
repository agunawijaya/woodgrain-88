/**
 * Standalone SVG rendering for Trailblaze Doodle export: 1600 × 800 canvas,
 * rounded stroke trails with 8-neighbour laidAt timing or 4-neighbour joins,
 * and look-specific styling for Neon, Toy Trains, Mummy, and Ice Trail.
 */
import type { Appearance } from '@woodgrain-88/kit';
import type { Cell, Seat } from '../engine/types.ts';
import { columnOf, rowOf } from '../engine/grid.ts';
import { lookById } from '../look/looks.ts';
import { seatColours, type SeatPalette } from '../look/seats.ts';
import type { LookId, SeatColours } from '../look/look.ts';

export interface DoodleArt {
  readonly cells: Int8Array;
  /** Tick each cell was laid on, to join the trail in the order it was drawn; optional. */
  readonly laidAt?: Int32Array;
  readonly look: LookId;
  readonly appearance: Appearance;
  readonly palette: SeatPalette;
}

const CELL_SIZE = 40;
const HALF_CELL = CELL_SIZE / 2;

function centreOf(cell: Cell): { cx: number; cy: number } {
  const col = columnOf(cell);
  const row = rowOf(cell);
  return {
    cx: col * CELL_SIZE + HALF_CELL,
    cy: row * CELL_SIZE + HALF_CELL,
  };
}

interface Edge {
  readonly from: Cell;
  readonly to: Cell;
}

function findEdgesAndStubs(
  cells: Int8Array,
  laidAt: Int32Array | undefined,
  seat: Seat,
): { edges: Edge[]; stubs: Cell[] } {
  const edges: Edge[] = [];
  const connected = new Set<Cell>();
  const seatCells: Cell[] = [];

  for (let c = 0; c < cells.length; c++) {
    if (cells[c] === seat) {
      seatCells.push(c);
    }
  }

  if (laidAt !== undefined) {
    // 8-neighbourhood: horizontal, vertical, and diagonal neighbours
    for (let i = 0; i < seatCells.length; i++) {
      const a = seatCells[i] as Cell;
      const colA = columnOf(a);
      const rowA = rowOf(a);
      const tickA = laidAt[a] as number;

      for (let j = i + 1; j < seatCells.length; j++) {
        const b = seatCells[j] as Cell;
        const colB = columnOf(b);
        const rowB = rowOf(b);

        if (Math.abs(colA - colB) <= 1 && Math.abs(rowA - rowB) <= 1) {
          const tickB = laidAt[b] as number;
          if (Math.abs(tickA - tickB) <= 15) {
            edges.push({ from: a, to: b });
            connected.add(a);
            connected.add(b);
          }
        }
      }
    }
  } else {
    // 4-neighbourhood: orthogonal horizontal and vertical neighbours
    for (let i = 0; i < seatCells.length; i++) {
      const a = seatCells[i] as Cell;
      const colA = columnOf(a);
      const rowA = rowOf(a);

      for (let j = i + 1; j < seatCells.length; j++) {
        const b = seatCells[j] as Cell;
        const colB = columnOf(b);
        const rowB = rowOf(b);

        const isOrthogonal =
          (Math.abs(colA - colB) === 1 && rowA === rowB) ||
          (Math.abs(rowA - rowB) === 1 && colA === colB);

        if (isOrthogonal) {
          edges.push({ from: a, to: b });
          connected.add(a);
          connected.add(b);
        }
      }
    }
  }

  const stubs: Cell[] = [];
  for (const cell of seatCells) {
    if (!connected.has(cell)) {
      stubs.push(cell);
    }
  }

  return { edges, stubs };
}

function buildMergedPath(edges: Edge[], stubs: Cell[]): string {
  if (edges.length === 0 && stubs.length === 0) {
    return '';
  }

  const adj = new Map<Cell, Set<Cell>>();
  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, new Set());
    if (!adj.has(to)) adj.set(to, new Set());
    adj.get(from)?.add(to);
    adj.get(to)?.add(from);
  }

  const parts: string[] = [];

  // Chain edges into polylines to keep the path compact
  while (adj.size > 0) {
    // Prefer starting at endpoints (odd degree) so strokes stay continuous
    let start: Cell | null = null;
    for (const [node, neighbours] of adj) {
      if (neighbours.size % 2 === 1) {
        start = node;
        break;
      }
    }
    if (start === null) {
      const firstEntry = adj.keys().next();
      if (!firstEntry.done) {
        start = firstEntry.value;
      }
    }
    if (start === null) break;

    let curr = start;
    const { cx: startX, cy: startY } = centreOf(curr);
    parts.push(`M ${startX} ${startY}`);

    for (;;) {
      const neighbours = adj.get(curr);
      if (!neighbours || neighbours.size === 0) {
        adj.delete(curr);
        break;
      }

      const next = neighbours.values().next().value as Cell;
      neighbours.delete(next);
      if (neighbours.size === 0) {
        adj.delete(curr);
      }

      const nextNeighbours = adj.get(next);
      if (nextNeighbours) {
        nextNeighbours.delete(curr);
        if (nextNeighbours.size === 0) {
          adj.delete(next);
        }
      }

      const { cx: nextX, cy: nextY } = centreOf(next);
      parts.push(`L ${nextX} ${nextY}`);
      curr = next;
    }
  }

  // Draw isolated cells as short stubs centered in their cells
  for (const stub of stubs) {
    const { cx, cy } = centreOf(stub);
    parts.push(`M ${cx - 0.5} ${cy} L ${cx + 0.5} ${cy}`);
  }

  return parts.join(' ');
}

function renderSeatPaths(look: LookId, pathD: string, colours: SeatColours): string {
  if (!pathD) {
    return '';
  }

  switch (look) {
    case 'neon': {
      return (
        `<path d="${pathD}" fill="none" stroke="${colours.main}" stroke-width="26" ` +
        `stroke-linecap="round" stroke-linejoin="round" opacity="0.6" filter="url(#neon-glow)"/>\n` +
        `<path d="${pathD}" fill="none" stroke="${colours.main}" stroke-width="14" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
    case 'trains': {
      return (
        `<path d="${pathD}" fill="none" stroke="${colours.deep}" stroke-width="18" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>\n` +
        `<path d="${pathD}" fill="none" stroke="${colours.main}" stroke-width="6" ` +
        `stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="6 6"/>`
      );
    }
    case 'mummy': {
      return (
        `<path d="${pathD}" fill="none" stroke="${colours.main}" stroke-width="24" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>\n` +
        `<path d="${pathD}" fill="none" stroke="#efe3c8" stroke-width="20" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
    case 'ice': {
      return (
        `<path d="${pathD}" fill="none" stroke="${colours.deep}" stroke-width="18" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>\n` +
        `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="6" ` +
        `stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`
      );
    }
  }
}

/** A standalone SVG document of the drawing, 1600 × 800, in the look's palette. */
export function doodleSvg(art: DoodleArt): string {
  const definition = lookById(art.look);
  const background = definition.background(art.appearance);
  const seats = seatColours(art.palette);

  const seat0Data = findEdgesAndStubs(art.cells, art.laidAt, 0);
  const seat1Data = findEdgesAndStubs(art.cells, art.laidAt, 1);

  const path0 = buildMergedPath(seat0Data.edges, seat0Data.stubs);
  const path1 = buildMergedPath(seat1Data.edges, seat1Data.stubs);

  const rendered0 = renderSeatPaths(art.look, path0, seats[0]);
  const rendered1 = renderSeatPaths(art.look, path1, seats[1]);

  const defs =
    art.look === 'neon'
      ? '  <defs>\n    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">\n      <feGaussianBlur stdDeviation="8" result="blur"/>\n    </filter>\n  </defs>\n'
      : '';

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" width="1600" height="800">\n' +
    `  <title>Trailblaze doodle</title>\n` +
    defs +
    `  <rect width="1600" height="800" fill="${background}"/>\n` +
    (rendered0 ? `  ${rendered0}\n` : '') +
    (rendered1 ? `  ${rendered1}\n` : '') +
    `</svg>\n`
  );
}
