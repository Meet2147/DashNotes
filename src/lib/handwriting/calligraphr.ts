/**
 * Import a filled-in Calligraphr sheet.
 *
 * Calligraphr's templates are a different animal from ours: a printed table with
 * dark grid lines, a label above each cell, a light-grey ghost letter inside it,
 * and a QR block — none of which our fixed-geometry extractor understands, and
 * none of it printed in the warm yellow our red-channel trick relies on. So this
 * importer doesn't assume any geometry at all. It finds the table's own grid
 * lines, rebuilds the cells from them, and reads the ink out of each cell.
 *
 * What it relies on instead:
 *   - a reasonably flat scan (Calligraphr itself requires scans, not photos)
 *   - dark grid lines and dark ink, light-grey ghosts/guides (their default)
 *   - cells ordered in ASCII sequence, which is how Calligraphr lays out its
 *     standard templates; the caller supplies the first character on the page
 *
 * Character identity is positional, so the review grid remains the safety net:
 * every imported glyph is shown against its baseline before anything is saved.
 */

import { CHARSET } from './charset';
import { connectedComponents, luminance, type GrayImage } from './image';
import { DEFAULT_METRICS, type GlyphMap, type GlyphSample } from './types';

/** Calligraphr's standard templates run through printable ASCII in order. */
const ASCII_FIRST = 33; // '!'
const ASCII_LAST = 126; // '~'

/** Characters whose bottoms sit on the baseline — used to locate it per row. */
const BASELINE_CHARS = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefhiklmnorstuvwxz'.split('')
);

const SIDE_BEARING = DEFAULT_METRICS.sideBearing;

interface Line {
  /** Centre of the line along its thin axis, px. */
  at: number;
  /** Extent along the long axis, px. */
  from: number;
  to: number;
}

interface CellBox {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
}

interface RawGlyph {
  cell: CellBox;
  char: string;
  coverage: Uint8ClampedArray;
  bufW: number;
  bufH: number;
  /** Ink bounding box in page px, or null when the cell is blank. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  empty: boolean;
}

/**
 * Estimate the scan's rotation by finding the angle at which the sheet's dark
 * pixels collapse into the sharpest horizontal bands. Real scans are rarely
 * perfectly straight, and even half a degree makes an axis-aligned cell clip
 * tilted grid lines through its interior — which is exactly how table fragments
 * ended up imported as "letters".
 */
function estimateSkew(dark: Uint8Array, width: number, height: number): number {
  const score = (theta: number): number => {
    const tan = Math.tan(theta);
    const bins = new Float64Array(height + 64);
    for (let y = 0; y < height; y += 2) {
      const row = y * width;
      for (let x = 0; x < width; x += 2) {
        if (!dark[row + x]) continue;
        const yp = Math.round(y - x * tan) + 32;
        if (yp >= 0 && yp < bins.length) bins[yp]++;
      }
    }
    let sum = 0;
    for (let i = 0; i < bins.length; i++) sum += bins[i] * bins[i];
    return sum;
  };

  let best = 0;
  let bestScore = -1;
  for (let deg = -3; deg <= 3.001; deg += 0.3) {
    const sc = score((deg * Math.PI) / 180);
    if (sc > bestScore) {
      bestScore = sc;
      best = deg;
    }
  }
  for (let deg = best - 0.3; deg <= best + 0.301; deg += 0.05) {
    const sc = score((deg * Math.PI) / 180);
    if (sc > bestScore) {
      bestScore = sc;
      best = deg;
    }
  }
  return (best * Math.PI) / 180;
}

/** Redraw the canvas rotated by -angle so the grid is axis-aligned. */
function deskew(source: HTMLCanvasElement, angle: number): HTMLCanvasElement {
  if (Math.abs(angle) < (0.05 * Math.PI) / 180) return source;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(-angle);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

export interface CalligraphrResult {
  glyphs: GlyphMap;
  captured: string[];
  /** Characters consumed by cells that held no ink. */
  blank: string[];
  /** Characters we read but do not support in profiles. */
  unsupported: string[];
  /** First character of the *next* page, for multi-page sheets. */
  nextChar: string | null;
  cellCount: number;
  /** Components discarded as sliced grid lines — high numbers mean a bad scan. */
  junkDropped: number;
  warnings: string[];
}

function percentileLuminance(img: GrayImage, p: number): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < img.data.length; i++) hist[img.data[i]]++;
  const target = img.data.length * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

/**
 * Find long straight dark lines by projection. `axis` 'h' scans rows for
 * horizontal lines, 'v' scans columns. Adjacent hits merge into one line with
 * its extent along the long axis recorded.
 */
function findLines(
  dark: Uint8Array,
  width: number,
  height: number,
  axis: 'h' | 'v',
  minFill: number
): Line[] {
  const thinLen = axis === 'h' ? height : width;
  const longLen = axis === 'h' ? width : height;
  const counts = new Int32Array(thinLen);
  const firsts = new Int32Array(thinLen).fill(-1);
  const lasts = new Int32Array(thinLen).fill(-1);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!dark[row + x]) continue;
      const thin = axis === 'h' ? y : x;
      const long = axis === 'h' ? x : y;
      counts[thin]++;
      if (firsts[thin] === -1) firsts[thin] = long;
      if (long > lasts[thin]) lasts[thin] = long;
      if (long < firsts[thin]) firsts[thin] = long;
    }
  }

  const minCount = longLen * minFill;
  const lines: Line[] = [];
  let start = -1;
  for (let t = 0; t <= thinLen; t++) {
    const hit = t < thinLen && counts[t] >= minCount;
    if (hit && start === -1) start = t;
    if (!hit && start !== -1) {
      let from = Infinity;
      let to = -Infinity;
      let weight = 0;
      let centre = 0;
      for (let u = start; u < t; u++) {
        if (firsts[u] !== -1 && firsts[u] < from) from = firsts[u];
        if (lasts[u] > to) to = lasts[u];
        centre += u * counts[u];
        weight += counts[u];
      }
      lines.push({ at: weight > 0 ? centre / weight : (start + t - 1) / 2, from, to });
      start = -1;
    }
  }
  return lines;
}

/** Median of a numeric array; NaN when empty. */
function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Rebuild the sheet's writing cells from its own grid.
 *
 * Rows come from the horizontal lines: the gaps between consecutive lines
 * alternate between short label strips and tall writing rows, and only the tall
 * ones hold ink. Columns come from the vertical lines that actually span each
 * row — Calligraphr's first rows are often narrower because the QR block sits
 * beside them, so the column set is computed per row, not once.
 */
function findCells(
  dark: Uint8Array,
  width: number,
  height: number
): { cells: CellBox[]; warnings: string[] } {
  const warnings: string[] = [];
  const hLines = findLines(dark, width, height, 'h', 0.3);
  const vLines = findLines(dark, width, height, 'v', 0.2);

  if (hLines.length < 4 || vLines.length < 3) {
    throw new Error(
      'No table grid was found. Upload a flat, well-lit scan of the Calligraphr sheet (PNG or JPG) — an angled photo will not work here.'
    );
  }

  // Bands between consecutive horizontal lines.
  const bands: { top: number; bottom: number }[] = [];
  for (let i = 0; i < hLines.length - 1; i++) {
    const top = hLines[i].at;
    const bottom = hLines[i + 1].at;
    if (bottom - top > 4) bands.push({ top, bottom });
  }
  const tallest = Math.max(...bands.map((b) => b.bottom - b.top));
  const writing = bands.filter((b) => b.bottom - b.top >= tallest * 0.55);
  if (writing.length === 0) throw new Error('The grid was found but no writing rows were.');

  /**
   * True when a vertical line is continuously dark across a band. Min/max
   * extents are not enough: a QR block sharing a line's columns stretches its
   * extent upward, which would admit the line into rows it never reaches and
   * shift every subsequent character assignment. Continuity is the real test —
   * a printed line is dark on ~every row it crosses; QR noise is dark on ~half.
   */
  const coversBand = (v: Line, top: number, bottom: number): boolean => {
    const x0 = Math.max(0, Math.round(v.at) - 3);
    const x1 = Math.min(width - 1, Math.round(v.at) + 3);
    let hit = 0;
    let total = 0;
    for (let y = Math.ceil(top + 2); y <= Math.floor(bottom - 2); y++) {
      total++;
      const row = y * width;
      for (let x = x0; x <= x1; x++) {
        if (dark[row + x]) {
          hit++;
          break;
        }
      }
    }
    return total > 0 && hit / total >= 0.85;
  };

  const cells: CellBox[] = [];
  writing.forEach((band, row) => {
    const spanning = vLines
      .filter((v) => coversBand(v, band.top, band.bottom))
      .sort((a, b) => a.at - b.at);

    for (let i = 0; i < spanning.length - 1; i++) {
      const x0 = spanning[i].at;
      const x1 = spanning[i + 1].at;
      const w = x1 - x0;
      if (w < width * 0.02 || w > width * 0.35) continue;
      cells.push({ x: x0, y: band.top, w, h: band.bottom - band.top, row });
    }
  });

  if (cells.length === 0) {
    throw new Error('The grid was found but no cells could be reconstructed from it.');
  }

  // Wildly varying cell widths usually mean the scan is skewed.
  const widths = cells.map((c) => c.w);
  const med = median(widths);
  if (widths.some((w) => w < med * 0.5 || w > med * 2)) {
    warnings.push('Cell sizes vary a lot — if results look wrong, re-scan the sheet flatter.');
  }

  return { cells, warnings };
}

/** ASCII printable sequence helper. */
function nextAscii(code: number): number | null {
  return code + 1 <= ASCII_LAST ? code + 1 : null;
}

/**
 * Read one page of a Calligraphr sheet.
 *
 * `startChar` is the character printed above the first (top-left) cell —
 * '!' on page one of their standard template; later pages continue wherever the
 * previous page stopped, which the previous call reports as `nextChar`.
 */
export function importCalligraphrSheet(
  sourceCanvas: HTMLCanvasElement,
  startChar: string
): CalligraphrResult {
  const startCode = startChar.charCodeAt(0);
  if (startChar.length !== 1 || startCode < ASCII_FIRST || startCode > ASCII_LAST) {
    throw new Error('The first character must be a single printable character, like ! or a.');
  }

  let canvas = sourceCanvas;
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  let gray = luminance(ctx.getImageData(0, 0, canvas.width, canvas.height));

  let white = Math.max(64, percentileLuminance(gray, 0.85));
  let dark = new Uint8Array(gray.width * gray.height);
  for (let i = 0; i < dark.length; i++) dark[i] = gray.data[i] < white * 0.5 ? 1 : 0;

  // Straighten the scan first: axis-aligned cells over a rotated grid clip the
  // table's own lines into the interiors, which imports as junk.
  const angle = estimateSkew(dark, gray.width, gray.height);
  const straightened = deskew(canvas, angle);
  if (straightened !== canvas) {
    canvas = straightened;
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    gray = luminance(ctx.getImageData(0, 0, canvas.width, canvas.height));
    white = Math.max(64, percentileLuminance(gray, 0.85));
    dark = new Uint8Array(gray.width * gray.height);
    for (let i = 0; i < dark.length; i++) dark[i] = gray.data[i] < white * 0.5 ? 1 : 0;
  }

  const { width, height } = gray;
  const inkCut = white * 0.55; // ink yes; grey ghosts and guides no
  const ramp = Math.max(16, white * 0.12);

  const { cells, warnings } = findCells(dark, width, height);

  // ---- First pass: pull ink coverage and its bounding box out of each cell ---

  const raw: RawGlyph[] = [];
  let code: number | null = startCode;
  const unsupported: string[] = [];
  let junkDropped = 0;
  let wideSkipped = 0;
  const medianCellW = median(cells.map((c) => c.w));

  for (const cell of cells) {
    if (code === null) break;

    // Calligraphr merges cells to hold its QR block. A merged cell is much wider
    // than the character cells and carries no character — consuming one here is
    // what shifted every subsequent letter's identity.
    if (cell.w > medianCellW * 1.45) {
      wideSkipped++;
      continue;
    }

    const char = String.fromCharCode(code);
    code = nextAscii(code);

    const insetX = Math.max(3, cell.w * 0.06);
    const insetY = Math.max(3, cell.h * 0.1);
    const x0 = Math.round(cell.x + insetX);
    const y0 = Math.round(cell.y + insetY);
    const w = Math.round(cell.w - insetX * 2);
    const h = Math.round(cell.h - insetY * 2);
    if (w < 4 || h < 4) continue;

    const coverage = new Uint8ClampedArray(w * h);
    let darkCount = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let y = 0; y < h; y++) {
      const srcRow = (y0 + y) * width + x0;
      for (let x = 0; x < w; x++) {
        const v = gray.data[srcRow + x];
        if (v >= inkCut) continue;
        coverage[y * w + x] = Math.min(255, ((inkCut - v) / ramp) * 255);
        darkCount++;
      }
    }

    // A QR block or a smudge of solid dark is not handwriting.
    if (darkCount > w * h * 0.22) {
      warnings.push(`One cell (assigned "${char}") was mostly solid ink and was skipped.`);
      raw.push({ cell, char, coverage, bufW: w, bufH: h, minX: 0, minY: 0, maxX: -1, maxY: -1, empty: true });
      continue;
    }

    // Drop specks the same way the native path does, then take the kept bbox.
    const { components, labels } = connectedComponents(coverage, w, h, 48, 1);
    let largest = 0;
    for (const c of components) if (c.area > largest) largest = c.area;
    const minArea = Math.max(14, largest * 0.02);

    // A component that spans the interior edge-to-edge, or is extremely long and
    // thin, is a sliced grid line — unless this character legitimately IS a long
    // thin stroke. Erase rejected components so they cannot resurface later.
    const legitimatelyThin = '-_=~"\',.'.includes(char);
    const rejected = new Set<number>();
    for (const c of components) {
      if (c.area < minArea) continue;
      const cw = c.maxX - c.minX + 1;
      const ch = c.maxY - c.minY + 1;
      const spansW = cw >= w - 3;
      const spansH = ch >= h - 3;
      const aspect = Math.max(cw / ch, ch / cw);
      const isLine =
        (spansW && ch < h * 0.25) ||
        (spansH && cw < w * 0.25) ||
        (!legitimatelyThin && aspect > 9 && Math.max(cw, ch) > Math.max(w, h) * 0.55);
      if (isLine) {
        rejected.add(Math.abs(c.label));
        junkDropped++;
      }
    }
    if (rejected.size > 0) {
      for (let i = 0; i < coverage.length; i++) {
        if (rejected.has(Math.abs(labels[i]))) coverage[i] = 0;
      }
    }

    for (const c of components) {
      if (c.area < minArea || rejected.has(Math.abs(c.label))) continue;
      if (c.minX < minX) minX = c.minX;
      if (c.minY < minY) minY = c.minY;
      if (c.maxX > maxX) maxX = c.maxX;
      if (c.maxY > maxY) maxY = c.maxY;
    }

    const empty = maxX < 0 || maxX - minX < 2 || maxY - minY < 2;
    raw.push({
      cell,
      char,
      coverage,
      bufW: w,
      bufH: h,
      minX: empty ? 0 : minX + x0,
      minY: empty ? 0 : minY + y0,
      maxX: empty ? -1 : maxX + x0,
      maxY: empty ? -1 : maxY + y0,
      empty,
    });
  }

  // ---- Typography: em from cap-height glyphs, baseline per row ---------------

  const capHeights = raw
    .filter((g) => !g.empty && /^[A-Z0-9]$/.test(g.char))
    .map((g) => g.maxY - g.minY + 1);
  const rowHeights = raw.map((g) => g.cell.h);
  const emPx =
    capHeights.length >= 3
      ? median(capHeights) / 0.72
      : median(rowHeights) * 0.55; // no caps on this page — approximate from the cell size

  const rows = new Map<number, RawGlyph[]>();
  for (const g of raw) {
    const list = rows.get(g.cell.row) ?? [];
    list.push(g);
    rows.set(g.cell.row, list);
  }
  const baselines = new Map<number, number>();
  for (const [row, list] of rows) {
    const bottoms = list
      .filter((g) => !g.empty && BASELINE_CHARS.has(g.char))
      .map((g) => g.maxY);
    const fallback = list[0].cell.y + list[0].cell.h * 0.72;
    baselines.set(row, bottoms.length >= 2 ? median(bottoms) : fallback);
  }

  // ---- Second pass: build the actual samples --------------------------------

  const glyphs: GlyphMap = {};
  const captured: string[] = [];
  const blank: string[] = [];
  const allowed = new Set(CHARSET);

  for (const g of raw) {
    if (g.empty) {
      blank.push(g.char);
      continue;
    }
    if (!allowed.has(g.char)) {
      unsupported.push(g.char);
      continue;
    }

    const baselineY = baselines.get(g.cell.row) ?? g.cell.y + g.cell.h * 0.72;
    const bw = g.maxX - g.minX + 1;
    const bh = g.maxY - g.minY + 1;

    // Crop the coverage buffer to the kept bbox.
    const insetX = Math.max(3, g.cell.w * 0.06);
    const insetY = Math.max(3, g.cell.h * 0.06);
    const bufX0 = g.minX - Math.round(g.cell.x + insetX);
    const bufY0 = g.minY - Math.round(g.cell.y + insetY);

    const canvas = document.createElement('canvas');
    canvas.width = bw;
    canvas.height = bh;
    const cctx = canvas.getContext('2d');
    if (!cctx) continue;
    const img = cctx.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const src = (bufY0 + y) * g.bufW + (bufX0 + x);
        if (src < 0 || src >= g.coverage.length) continue;
        img.data[(y * bw + x) * 4 + 3] = g.coverage[src];
      }
    }
    cctx.putImageData(img, 0, 0);

    const wEm = bw / emPx;
    const sample: GlyphSample = {
      png: canvas.toDataURL('image/png'),
      wEm,
      hEm: bh / emPx,
      leftEm: SIDE_BEARING,
      topEm: (g.minY - baselineY) / emPx,
      advanceEm: wEm + SIDE_BEARING * 2,
      source: 'sheet',
    };
    glyphs[g.char] = [sample];
    captured.push(g.char);
  }

  const lastConsumed = startCode + raw.length - 1;
  const nextCode = raw.length > 0 ? nextAscii(lastConsumed) : startCode;

  if (wideSkipped > 0) {
    warnings.push(`${wideSkipped} merged cells (the QR block area) were skipped.`);
  }
  if (junkDropped > Math.max(4, captured.length * 0.35)) {
    warnings.push(
      `${junkDropped} grid-line fragments had to be filtered out — if letters look wrong, re-scan the sheet flatter and straighter.`
    );
  }

  return {
    glyphs,
    captured,
    blank,
    unsupported: Array.from(new Set(unsupported)),
    nextChar: nextCode === null ? null : String.fromCharCode(nextCode),
    cellCount: raw.length,
    junkDropped,
    warnings,
  };
}
