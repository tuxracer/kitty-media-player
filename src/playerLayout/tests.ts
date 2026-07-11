import { describe, expect, it } from 'vitest';

import { computePanelRegion, computeEmbeddedRegion, MAX_PANEL_COLS } from './index.ts';

// 240x140 source: aspect ratio (240/140) * 2 = 24/7 cols per row
const SOURCE = { sourceWidth: 240, sourceHeight: 140 };

describe('computePanelRegion', () => {
  it('caps cols at MAX_PANEL_COLS on a wide terminal and derives rows by aspect', () => {
    // availableCols = min(296, 100) = 100, rows = floor(100 / (24/7)) = 29
    const region = computePanelRegion({ termCols: 300, termRows: 100, ...SOURCE });
    expect(region).toEqual({ offsetCol: 1, offsetRow: 1, cols: MAX_PANEL_COLS, rows: 29 });
  });

  it('subtracts the horizontal margin when the terminal is below the cap', () => {
    // availableCols = 80 - 4 = 76, rows = floor(76 / (24/7)) = 22
    const region = computePanelRegion({ termCols: 80, termRows: 100, ...SOURCE });
    expect(region).toEqual({ offsetCol: 1, offsetRow: 1, cols: 76, rows: 22 });
  });

  it('is limited by rows on a short terminal', () => {
    // availableRows = 15 - 5 = 10, cols = floor(10 * (24/7)) = 34
    const region = computePanelRegion({ termCols: 200, termRows: 15, ...SOURCE });
    expect(region).toEqual({ offsetCol: 1, offsetRow: 1, cols: 34, rows: 10 });
  });

  it('returns at least 1x1 on a tiny terminal without throwing', () => {
    const region = computePanelRegion({ termCols: 10, termRows: 4, ...SOURCE });
    expect(region.cols).toBeGreaterThanOrEqual(1);
    expect(region.rows).toBeGreaterThanOrEqual(1);
    expect(region.offsetCol).toBe(1);
    expect(region.offsetRow).toBe(1);
  });

  it('always places the region at offset 1,1', () => {
    const terminals = [
      { termCols: 300, termRows: 100 },
      { termCols: 80, termRows: 100 },
      { termCols: 200, termRows: 15 },
      { termCols: 10, termRows: 4 },
    ];
    for (const terminal of terminals) {
      const region = computePanelRegion({ ...terminal, ...SOURCE });
      expect(region.offsetCol).toBe(1);
      expect(region.offsetRow).toBe(1);
    }
  });
});

describe('computeEmbeddedRegion', () => {
  // 1920x1080 source: aspect ratio (1920/1080) * 2 = 32/9 cols per row
  const WIDESCREEN = { sourceWidth: 1920, sourceHeight: 1080 };

  it('fills the width and letterboxes the rows for a wide source in a squat box', () => {
    // height-first fit: 12 * 32/9 = 42.67 cols > 40, so clamp to 40 cols,
    // rows = floor(40 / (32/9)) = 11
    const region = computeEmbeddedRegion({ cols: 40, rows: 12, ...WIDESCREEN });
    expect(region).toEqual({ offsetCol: 1, offsetRow: 1, cols: 40, rows: 11 });
  });

  it('fills the height and letterboxes the cols when the box is wide enough', () => {
    // 8 * 32/9 = 28.4, floor 28 <= 40
    const region = computeEmbeddedRegion({ cols: 40, rows: 8, ...WIDESCREEN });
    expect(region).toEqual({ offsetCol: 1, offsetRow: 1, cols: 28, rows: 8 });
  });

  it('handles a square source', () => {
    // aspect 1 * 2 = 2 cols per row, 12 * 2 = 24 <= 40
    const region = computeEmbeddedRegion({ cols: 40, rows: 12, sourceWidth: 100, sourceHeight: 100 });
    expect(region).toEqual({ offsetCol: 1, offsetRow: 1, cols: 24, rows: 12 });
  });

  it('returns at least 1x1 for a degenerate box', () => {
    const region = computeEmbeddedRegion({ cols: 0, rows: 0, ...WIDESCREEN });
    expect(region.cols).toBeGreaterThanOrEqual(1);
    expect(region.rows).toBeGreaterThanOrEqual(1);
  });
});
