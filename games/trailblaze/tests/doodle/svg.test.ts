/**
 * Tests for Trailblaze Doodle SVG generation: XML validity, root attributes and title,
 * per-look stroke treatments, laidAt and 4-neighbour stroke joining, and under-200-KB size.
 */
import { describe, expect, it } from 'vitest';
import type { LookId } from '../../src/look/look.ts';
import { LOOK_IDS } from '../../src/look/looks.ts';
import { CELL_COUNT, EMPTY } from '../../src/engine/types.ts';
import { cellAt } from '../../src/engine/grid.ts';
import { doodleSvg, type DoodleArt } from '../../src/doodle/svg.ts';

function validateXmlOutline(svg: string): void {
  // Check root element
  expect(svg).toMatch(/^<svg\b[^>]*>/);
  expect(svg).toMatch(/<\/svg>\s*$/);

  // Must have viewBox and xmlns
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('viewBox="0 0 1600 800"');
  expect(svg).toContain('<title>Trailblaze doodle</title>');

  // No script tags allowed
  expect(svg).not.toMatch(/<script\b/i);

  // No external href links, only fragment identifiers (#...)
  const hrefMatches = svg.matchAll(/\bhref=["']([^"']*)["']/g);
  for (const match of hrefMatches) {
    const target = match[1];
    expect(target?.startsWith('#')).toBe(true);
  }

  // If DOMParser is available in this test environment, parse it
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    expect(parserError).toBeNull();
  }
}

describe('Doodle SVG', () => {
  it('generates valid XML for each look in both day and night appearances', () => {
    const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
    // Add simple trails for seat 0 and seat 1
    cells[cellAt(5, 5)] = 0;
    cells[cellAt(6, 5)] = 0;
    cells[cellAt(7, 5)] = 0;

    cells[cellAt(20, 10)] = 1;
    cells[cellAt(20, 11)] = 1;

    for (const look of LOOK_IDS) {
      for (const appearance of ['light', 'dark'] as const) {
        const art: DoodleArt = {
          cells,
          look,
          appearance,
          palette: 'standard',
        };
        const svg = doodleSvg(art);
        validateXmlOutline(svg);
      }
    }
  });

  describe('per-look stroke treatments', () => {
    const baseArt = (look: LookId): DoodleArt => {
      const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
      cells[cellAt(10, 10)] = 0;
      cells[cellAt(11, 10)] = 0;
      return {
        cells,
        look,
        appearance: 'dark',
        palette: 'standard',
      };
    };

    it('neon: includes feGaussianBlur glow filter and glow under-layer', () => {
      const svg = doodleSvg(baseArt('neon'));
      expect(svg).toContain('feGaussianBlur');
      expect(svg).toContain('stroke-width="14"');
    });

    it('trains: includes 18-wide deep bed and 6-wide dashed main sleepers stroke', () => {
      const svg = doodleSvg(baseArt('trains'));
      expect(svg).toContain('stroke-width="18"');
      expect(svg).toContain('stroke-width="6"');
      expect(svg).toContain('stroke-dasharray');
    });

    it('mummy: includes cream stroke and main bounding stroke', () => {
      const svg = doodleSvg(baseArt('mummy'));
      expect(svg).toContain('#efe3c8');
      expect(svg).toContain('stroke-width="20"');
      expect(svg).toContain('stroke-width="24"');
    });

    it('ice: includes 18-wide deep stroke under 6-wide white sheen at 0.7 opacity', () => {
      const svg = doodleSvg(baseArt('ice'));
      expect(svg).toContain('stroke-width="18"');
      expect(svg).toContain('stroke-width="6"');
      expect(svg).toContain('#ffffff');
      expect(svg).toContain('0.7');
    });
  });

  describe('trail joining logic', () => {
    it('joins neighbouring cells when laidAt difference is at most 15 ticks', () => {
      const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
      const laidAt = new Int32Array(CELL_COUNT).fill(-1);

      // (5, 5) at tick 10 and (6, 5) at tick 25 (diff 15) -> joined
      const c1 = cellAt(5, 5);
      const c2 = cellAt(6, 5);
      cells[c1] = 0;
      cells[c2] = 0;
      laidAt[c1] = 10;
      laidAt[c2] = 25;

      // (10, 10) at tick 0 and (11, 10) at tick 50 (diff 50 > 15) -> not joined, drawn as stubs
      const c3 = cellAt(10, 10);
      const c4 = cellAt(11, 10);
      cells[c3] = 0;
      cells[c4] = 0;
      laidAt[c3] = 0;
      laidAt[c4] = 50;

      const art: DoodleArt = {
        cells,
        laidAt,
        look: 'ice',
        appearance: 'dark',
        palette: 'standard',
      };
      const svg = doodleSvg(art);
      validateXmlOutline(svg);

      // Center of (5,5) is (220, 220), (6,5) is (260, 220)
      expect(svg).toMatch(/M\s*220\s+220\s+L\s*260\s+220|M\s*260\s+220\s+L\s*220\s+220/);
    });

    it('joins 4-neighbour cells when laidAt is omitted', () => {
      const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
      // Orthogonal horizontal pair
      cells[cellAt(2, 2)] = 1;
      cells[cellAt(3, 2)] = 1;

      const art: DoodleArt = {
        cells,
        look: 'neon',
        appearance: 'dark',
        palette: 'standard',
      };
      const svg = doodleSvg(art);
      validateXmlOutline(svg);

      // Center of (2,2) is (100, 100), (3,2) is (140, 100)
      expect(svg).toMatch(/M\s*100\s+100\s+L\s*140\s+100|M\s*140\s+100\s+L\s*100\s+100/);
    });

    it('draws isolated cells as short stubs on their own', () => {
      const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
      cells[cellAt(5, 5)] = 0; // Isolated cell

      const art: DoodleArt = {
        cells,
        look: 'neon',
        appearance: 'dark',
        palette: 'standard',
      };
      const svg = doodleSvg(art);
      validateXmlOutline(svg);

      // Contains a stub around (220, 220)
      expect(svg).toContain('220');
    });
  });

  describe('size constraint', () => {
    it('keeps a completely full board under 200 KB', () => {
      const cells = new Int8Array(CELL_COUNT);
      // Alternate seats across the entire board
      for (let c = 0; c < CELL_COUNT; c++) {
        cells[c] = c % 2 === 0 ? 0 : 1;
      }

      for (const look of LOOK_IDS) {
        const art: DoodleArt = {
          cells,
          look,
          appearance: 'dark',
          palette: 'standard',
        };
        const svg = doodleSvg(art);
        const byteSize = new TextEncoder().encode(svg).length;

        expect(byteSize).toBeLessThan(200 * 1024);
      }
    });
  });
});
