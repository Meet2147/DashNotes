/**
 * Turn a photo (or scan) of a filled-in capture sheet into glyph samples.
 *
 * Steps:
 *   1. Find the four black corner markers — or accept corners the user dragged.
 *   2. Solve the homography from template space to photo space and rectify, so
 *      a hand-held phone shot becomes a flat sheet at a known scale.
 *   3. Threshold the red channel into ink coverage (the yellow printed guides
 *      vanish; see image.ts).
 *   4. Slice out each cell, drop specks, and record the ink's bounding box
 *      relative to that cell's printed baseline.
 *
 * Because step 4 measures against the *printed* baseline rather than guessing
 * one, ascenders and descenders land at the right height when re-rendered —
 * that is what stops the output looking like letters bouncing on a trampoline.
 */

import {
  CHARSET,
  TEMPLATE,
  templateCells,
  type CellRect,
} from './charset';
import {
  computeHomography,
  connectedComponents,
  findRegistrationMarkers,
  inkCoverage,
  redChannel,
  warpPerspective,
  type GrayImage,
  type Point,
} from './image';
import { DEFAULT_METRICS, type GlyphMap, type GlyphSample } from './types';

const PX_PER_MM = TEMPLATE.rectifyPxPerMm;
const EM_PX = TEMPLATE.emMm * PX_PER_MM;

/** Ink coverage at or above this counts as a stroke. */
const INK_AT = 48;

export interface DetectedCorners {
  points: Point[];
  auto: boolean;
}

export interface ExtractionResult {
  glyphs: GlyphMap;
  captured: string[];
  missing: string[];
  /** Rectified sheet, handy for showing the user what we actually read. */
  rectified: HTMLCanvasElement;
  /**
   * True when what we sliced looks like grid lines rather than handwriting —
   * the signature of a different template (e.g. a Calligraphr sheet) being fed
   * to our fixed geometry. Callers should refuse the result rather than let the
   * user save a profile full of table borders.
   */
  suspicious: boolean;
  suspicionReason?: string;
}

/** Marker centres in rectified-sheet pixels. */
export function canonicalMarkerPoints(): Point[] {
  return TEMPLATE.markerCentresMm.map((m) => ({ x: m.x * PX_PER_MM, y: m.y * PX_PER_MM }));
}

export const TEMPLATE_MARKER_ASPECT =
  (TEMPLATE.markerCentresMm[1].x - TEMPLATE.markerCentresMm[0].x) /
  (TEMPLATE.markerCentresMm[2].y - TEMPLATE.markerCentresMm[0].y);

/**
 * Try to find the sheet's corners automatically.
 * Returns the four marker centres in source-image pixel coordinates, ordered
 * top-left, top-right, bottom-left, bottom-right.
 */
export function detectCorners(sourceCanvas: HTMLCanvasElement): DetectedCorners {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const gray = redChannel(img);
  const found = findRegistrationMarkers(gray, TEMPLATE_MARKER_ASPECT);
  if (found) return { points: found, auto: true };

  // No luck — hand back a sensible starting quad for the user to drag.
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ix = w * 0.07;
  const iy = h * 0.05;
  return {
    points: [
      { x: ix, y: iy },
      { x: w - ix, y: iy },
      { x: ix, y: h - iy },
      { x: w - ix, y: h - iy },
    ],
    auto: false,
  };
}

/** Rectify the sheet into flat template space at PX_PER_MM. */
export function rectifySheet(sourceCanvas: HTMLCanvasElement, corners: Point[]): GrayImage {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const gray = redChannel(ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height));

  const outW = Math.round(TEMPLATE.pageWidthMm * PX_PER_MM);
  const outH = Math.round(TEMPLATE.pageHeightMm * PX_PER_MM);

  // Map rectified space -> source space, then sample backwards.
  const h = computeHomography(canonicalMarkerPoints(), corners);
  if (!h) throw new Error('Those four corners are degenerate — please reposition them.');
  return warpPerspective(gray, h, outW, outH);
}

function grayToCanvas(img: GrayImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const out = ctx.createImageData(img.width, img.height);
  for (let i = 0, p = 0; i < img.data.length; i++, p += 4) {
    const v = img.data[i];
    out.data[p] = v;
    out.data[p + 1] = v;
    out.data[p + 2] = v;
    out.data[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** The window inside a cell that we read ink from, in rectified px. */
function cellInkWindow(cell: CellRect) {
  const x = Math.round((cell.x + TEMPLATE.extractInsetXMm) * PX_PER_MM);
  const y = Math.round((cell.y + TEMPLATE.extractTopMm) * PX_PER_MM);
  const w = Math.round((cell.w - TEMPLATE.extractInsetXMm * 2) * PX_PER_MM);
  const h = Math.round((cell.h - TEMPLATE.extractTopMm) * PX_PER_MM);
  return { x, y, w, h };
}

/**
 * Build a glyph from a coverage buffer.
 * `baselineY` is in the same pixel space as the buffer; `emPx` sets the scale.
 */
function buildSample(
  coverage: Uint8ClampedArray,
  bufWidth: number,
  bufHeight: number,
  baselineY: number,
  emPx: number,
  source: GlyphSample['source']
): GlyphSample | null {
  const { components, labels } = connectedComponents(coverage, bufWidth, bufHeight, INK_AT, 1);
  if (components.length === 0) return null;

  let largest = 0;
  for (const c of components) {
    if (c.area > largest) largest = c.area;
  }
  // Keep dots on i/j and the tail of a comma, drop paper grain and JPEG mush.
  const minArea = Math.max(18, largest * 0.02);

  const keep = new Set<number>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of components) {
    if (c.area < minArea) continue;
    keep.add(Math.abs(c.label));
    if (c.minX < minX) minX = c.minX;
    if (c.minY < minY) minY = c.minY;
    if (c.maxX > maxX) maxX = c.maxX;
    if (c.maxY > maxY) maxY = c.maxY;
  }
  if (keep.size === 0 || maxX < 0) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (bw < 2 || bh < 2) return null;

  const canvas = document.createElement('canvas');
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const out = ctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) {
    const srcRow = (minY + y) * bufWidth;
    const dstRow = y * bw;
    for (let x = 0; x < bw; x++) {
      const src = srcRow + minX + x;
      if (!keep.has(Math.abs(labels[src]))) continue;
      const p = (dstRow + x) * 4;
      // Black ink; the alpha channel carries stroke coverage so edges stay soft.
      out.data[p + 3] = coverage[src];
    }
  }
  ctx.putImageData(out, 0, 0);

  const sideBearing = DEFAULT_METRICS.sideBearing;
  const wEm = bw / emPx;
  return {
    png: canvas.toDataURL('image/png'),
    wEm,
    hEm: bh / emPx,
    leftEm: sideBearing,
    topEm: (minY - baselineY) / emPx,
    advanceEm: wEm + sideBearing * 2,
    source,
  };
}

/**
 * Full sheet -> glyphs. Runs synchronously; callers should yield to the event
 * loop around it (see SheetUploader) so the UI can paint a progress state.
 */
export function extractGlyphs(sourceCanvas: HTMLCanvasElement, corners: Point[]): ExtractionResult {
  const rectified = rectifySheet(sourceCanvas, corners);

  // ~2.5mm window: wide enough to span a pen stroke, tight enough to track
  // the brightness gradient across a photo taken under a desk lamp.
  const coverage = inkCoverage(rectified, Math.round(2.5 * PX_PER_MM), 14);

  const glyphs: GlyphMap = {};
  const captured: string[] = [];
  const missing: string[] = [];
  let throughLines = 0;

  for (const cell of templateCells()) {
    const win = cellInkWindow(cell);
    const buf = new Uint8ClampedArray(win.w * win.h);
    for (let y = 0; y < win.h; y++) {
      const srcRow = (win.y + y) * rectified.width + win.x;
      buf.set(coverage.subarray(srcRow, srcRow + win.w), y * win.w);
    }

    const baselineInWindow = (cell.y + TEMPLATE.baselineMm) * PX_PER_MM - win.y;
    const sample = buildSample(buf, win.w, win.h, baselineInWindow, EM_PX, 'sheet');
    if (sample) {
      glyphs[cell.char] = [sample];
      captured.push(cell.char);
      // Handwriting never spans a whole extraction window; a printed grid line
      // sliced by our cell positions does.
      if (sample.wEm * EM_PX > win.w * 0.85 || sample.hEm * EM_PX > win.h * 0.85) {
        throughLines++;
      }
    } else {
      missing.push(cell.char);
    }
  }

  const suspicious = captured.length >= 12 && throughLines / captured.length > 0.3;

  return {
    glyphs,
    captured,
    missing,
    rectified: grayToCanvas(rectified),
    suspicious,
    suspicionReason: suspicious
      ? `${throughLines} of ${captured.length} cells look like sliced grid lines, not handwriting — this is probably not the DashNotes capture sheet.`
      : undefined,
  };
}

/**
 * Build a glyph from a canvas the user drew on directly (draw pad or on-screen
 * sheet). No perspective correction needed — we already know the geometry, so
 * this path is exact.
 */
export function sampleFromDrawing(
  canvas: HTMLCanvasElement,
  baselineY: number,
  emPx: number
): GlyphSample | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const coverage = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, p = 3; i < coverage.length; i++, p += 4) {
    coverage[i] = img.data[p];
  }
  return buildSample(coverage, canvas.width, canvas.height, baselineY, emPx, 'draw');
}

/** Merge newly captured glyphs into a profile, keeping earlier samples as variants. */
export function mergeGlyphs(base: GlyphMap, incoming: GlyphMap, maxSamples = 3): GlyphMap {
  const out: GlyphMap = { ...base };
  for (const [char, samples] of Object.entries(incoming)) {
    const existing = out[char] ?? [];
    out[char] = [...existing, ...samples].slice(-maxSamples);
  }
  return out;
}

/** Which template characters a profile still needs. */
export function missingFrom(glyphs: GlyphMap): string[] {
  return CHARSET.filter((c) => !glyphs[c] || glyphs[c].length === 0);
}
