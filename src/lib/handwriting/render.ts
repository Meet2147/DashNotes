/**
 * Paints laid-out glyphs onto canvases.
 *
 * Stored glyphs are black masks with the stroke in the alpha channel, so the ink
 * colour is applied at render time by compositing a solid fill through the mask
 * ('source-in'). Tinted results are cached per glyph/colour/pen so a multi-page
 * document does not re-tint the letter 'e' several hundred times.
 */

import type { RenderContext } from './context';
import { drawPaper } from './paper';
import type { GlyphMap, GlyphSample, LaidOutPage, PlacedGlyph } from './types';

export type GlyphImages = Map<string, HTMLImageElement>;

interface TintedGlyph {
  canvas: HTMLCanvasElement;
  /** Padding added around the mask to make room for stroke thickening, in mask px. */
  pad: number;
  maskWidth: number;
  maskHeight: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A stored glyph image could not be decoded.'));
    img.src = src;
  });
}

/** Decode every stored glyph up front, keyed by its data URL. */
export async function loadGlyphImages(glyphs: GlyphMap): Promise<GlyphImages> {
  const urls = new Set<string>();
  for (const samples of Object.values(glyphs)) {
    for (const s of samples) {
      if (s.png) urls.add(s.png);
    }
  }
  const entries = await Promise.all(
    Array.from(urls).map(async (url) => [url, await loadImage(url)] as const)
  );
  return new Map(entries);
}

/**
 * Cap on cached tinted glyphs. Dragging the pen-width or ink-colour control
 * generates a fresh variant of every glyph per step, so without a bound the cache
 * would grow into hundreds of megabytes of offscreen canvases. Re-tinting is
 * cheap, so when the cap is hit we simply start over.
 */
const TINT_CACHE_LIMIT = 400;

export class GlyphPainter {
  private cache = new Map<string, TintedGlyph>();

  constructor(private images: GlyphImages) {}

  private tint(sample: GlyphSample, color: string, penWidth: number): TintedGlyph | null {
    const key = `${sample.png}|${color}|${penWidth.toFixed(2)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (this.cache.size >= TINT_CACHE_LIMIT) this.cache.clear();

    const img = this.images.get(sample.png);
    if (!img || img.width === 0 || img.height === 0) return null;

    // Thicken by dilating the mask: draw it repeatedly on a small circle. The
    // radius is expressed in em so it looks the same at any capture resolution.
    const nativeEmPx = sample.hEm > 0 ? img.height / sample.hEm : img.height;
    const dilate = Math.max(0, penWidth - 1) * nativeEmPx * 0.035;
    const pad = Math.ceil(dilate) + 1;

    const canvas = document.createElement('canvas');
    canvas.width = img.width + pad * 2;
    canvas.height = img.height + pad * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, pad, pad);
    if (dilate > 0.3) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.drawImage(img, pad + Math.cos(a) * dilate, pad + Math.sin(a) * dilate);
      }
    }

    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tinted: TintedGlyph = { canvas, pad, maskWidth: img.width, maskHeight: img.height };
    this.cache.set(key, tinted);
    return tinted;
  }

  draw(ctx: CanvasRenderingContext2D, g: PlacedGlyph, color: string, penWidth: number): void {
    const tinted = this.tint(g.sample, color, penWidth);
    if (!tinted || g.w <= 0 || g.h <= 0) return;

    // A pen lighter than 1 cannot be eroded, so fade it instead — visually the
    // same read as a finer nib.
    const thinAlpha = penWidth < 1 ? 0.55 + 0.45 * penWidth : 1;
    const padX = (tinted.pad / tinted.maskWidth) * g.w;
    const padY = (tinted.pad / tinted.maskHeight) * g.h;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, g.alpha * thinAlpha));

    // Rotate and shear about the glyph's own baseline, so slant leans the letter
    // rather than sliding it sideways.
    const pivotX = g.x + g.w / 2;
    const pivotY = g.baselineY;
    ctx.translate(pivotX, pivotY);
    if (g.slant !== 0) ctx.transform(1, 0, -Math.tan(g.slant), 1, 0, 0);
    if (g.rotation !== 0) ctx.rotate(g.rotation);
    ctx.translate(-pivotX, -pivotY);

    ctx.drawImage(tinted.canvas, g.x - padX, g.y - padY, g.w + padX * 2, g.h + padY * 2);
    ctx.restore();
  }
}

/** Render one page (paper + ink) onto a fresh canvas. */
export function renderPage(
  page: LaidOutPage,
  rc: RenderContext,
  painter: GlyphPainter
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rc.pageWidthPx;
  canvas.height = rc.pageHeightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  drawPaper(ctx, rc);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const line of page.lines) {
    for (const glyph of line.glyphs) {
      painter.draw(ctx, glyph, rc.settings.inkColor, rc.settings.penWidth);
    }
  }
  return canvas;
}

/** Render one page onto a canvas the caller already owns (used by the live preview). */
export function renderPageInto(
  target: HTMLCanvasElement,
  page: LaidOutPage,
  rc: RenderContext,
  painter: GlyphPainter
): void {
  target.width = rc.pageWidthPx;
  target.height = rc.pageHeightPx;
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  drawPaper(ctx, rc);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const line of page.lines) {
    for (const glyph of line.glyphs) {
      painter.draw(ctx, glyph, rc.settings.inkColor, rc.settings.penWidth);
    }
  }
}
