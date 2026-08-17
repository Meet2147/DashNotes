/**
 * Draws the page the handwriting sits on: ruled, ruled with a margin line,
 * squared, or blank.
 *
 * Rule positions come from the shared RenderContext, so the baselines the
 * layout engine picked and the lines drawn here are the same numbers — the text
 * genuinely rests on the ruling rather than being separately approximated.
 */

import type { RenderContext } from './context';
import { makeRng } from './rng';

/** How far in from the paper edge the ruling runs, in mm. */
const RULE_BLEED_MM = 8;

let noiseTile: HTMLCanvasElement | null = null;

/** A small tileable grain pattern, generated once and reused. */
function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.createImageData(size, size);
  const rng = makeRng(0x5eed17);
  for (let i = 0, p = 0; i < size * size; i++, p += 4) {
    const v = 140 + Math.floor(rng() * 115);
    img.data[p] = v;
    img.data[p + 1] = v;
    img.data[p + 2] = v - 4;
    img.data[p + 3] = Math.floor(rng() * 26);
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = canvas;
  return canvas;
}

export function drawPaper(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  const { settings, pageWidthPx, pageHeightPx, pxPerMm } = rc;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.fillStyle = settings.paperTint;
  ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);

  if (settings.paperTexture > 0) {
    const pattern = ctx.createPattern(getNoiseTile(), 'repeat');
    if (pattern) {
      ctx.globalAlpha = Math.min(1, settings.paperTexture) * 0.55;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
      ctx.globalAlpha = 1;
    }
  }

  const bleed = RULE_BLEED_MM * pxPerMm;
  const ruleWidth = Math.max(0.7, 0.16 * pxPerMm);

  if (settings.paper === 'grid') {
    const step = 5 * pxPerMm;
    ctx.strokeStyle = settings.ruleColor;
    ctx.lineWidth = ruleWidth;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let x = bleed; x <= pageWidthPx - bleed; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, bleed);
      ctx.lineTo(Math.round(x) + 0.5, pageHeightPx - bleed);
    }
    for (let y = bleed; y <= pageHeightPx - bleed; y += step) {
      ctx.moveTo(bleed, Math.round(y) + 0.5);
      ctx.lineTo(pageWidthPx - bleed, Math.round(y) + 0.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (settings.paper === 'blank') {
    ctx.restore();
    return;
  }

  // Ruled variants.
  ctx.strokeStyle = settings.ruleColor;
  ctx.lineWidth = ruleWidth;
  ctx.beginPath();
  for (const y of rc.ruleYs) {
    const py = Math.round(y) + 0.5;
    ctx.moveTo(bleed, py);
    ctx.lineTo(pageWidthPx - bleed, py);
  }
  ctx.stroke();

  if (settings.paper === 'ruled-margin' || settings.paper === 'college') {
    const marginX = Math.round(rc.marginsPx.left - 1.5 * pxPerMm) + 0.5;
    ctx.strokeStyle = settings.marginLineColor;
    ctx.lineWidth = Math.max(0.8, 0.2 * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(marginX, bleed);
    ctx.lineTo(marginX, pageHeightPx - bleed);
    ctx.stroke();
  }

  if (settings.paper === 'college') {
    // Double rule under the top margin, the way a school exercise book heads a page.
    const y = Math.round(rc.marginsPx.top - 2.4 * pxPerMm) + 0.5;
    ctx.strokeStyle = settings.marginLineColor;
    ctx.lineWidth = Math.max(0.8, 0.2 * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(bleed, y);
    ctx.lineTo(pageWidthPx - bleed, y);
    ctx.moveTo(bleed, y - Math.max(2, 0.8 * pxPerMm));
    ctx.lineTo(pageWidthPx - bleed, y - Math.max(2, 0.8 * pxPerMm));
    ctx.stroke();
  }

  ctx.restore();
}
