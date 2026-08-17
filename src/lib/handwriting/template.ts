/**
 * Draws the printable capture sheet.
 *
 * This and extract.ts are two halves of one contract: both read their geometry
 * from TEMPLATE, so a cell drawn here is the cell sliced there. If you move
 * anything, move it in charset.ts.
 */

import { CHARSET, TEMPLATE, TEMPLATE_ROWS, templateCells } from './charset';

/** Human-readable name for characters whose glyph is ambiguous at small sizes. */
const LABEL_HINTS: Record<string, string> = {
  "'": 'apostrophe',
  '"': 'quote',
  '.': 'full stop',
  ',': 'comma',
  '-': 'hyphen',
  '_': 'underscore',
  '~': 'tilde',
};

export interface TemplateSheetOptions {
  /** Output resolution. 200dpi prints crisply and keeps the PNG a sane size. */
  dpi?: number;
  /** Shown in the footer, e.g. "Sheet 2 — second sample of each letter". */
  subtitle?: string;
}

export function drawTemplateSheet(options: TemplateSheetOptions = {}): HTMLCanvasElement {
  const dpi = options.dpi ?? 200;
  const pxPerMm = dpi / 25.4;
  const mm = (v: number) => v * pxPerMm;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(mm(TEMPLATE.pageWidthMm));
  canvas.height = Math.round(mm(TEMPLATE.pageHeightMm));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Registration markers: the only black on the page ---------------------
  ctx.fillStyle = TEMPLATE.markerColor;
  const markerPx = mm(TEMPLATE.markerSizeMm);
  for (const centre of TEMPLATE.markerCentresMm) {
    ctx.fillRect(
      Math.round(mm(centre.x) - markerPx / 2),
      Math.round(mm(centre.y) - markerPx / 2),
      Math.round(markerPx),
      Math.round(markerPx)
    );
  }

  // --- Header ---------------------------------------------------------------
  const sans = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillStyle = TEMPLATE.headerColor;
  ctx.textBaseline = 'alphabetic';

  ctx.font = `600 ${Math.round(mm(4.6))}px ${sans}`;
  ctx.fillText('DashNotes — handwriting capture sheet', mm(23), mm(26));

  ctx.font = `${Math.round(mm(2.9))}px ${sans}`;
  const lines = [
    'Write each character once, inside its box, sitting on the dotted baseline. Use a black or blue pen (not red).',
    'Write at a comfortable natural size — do not try to fill the whole box. Keep strokes inside the box.',
    'Then photograph or scan the whole sheet, including all four black corner squares, and upload it.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, mm(23), mm(31.5 + i * 3.6));
  });

  if (options.subtitle) {
    ctx.font = `600 ${Math.round(mm(3))}px ${sans}`;
    ctx.fillText(options.subtitle, mm(23), mm(TEMPLATE.pageHeightMm - 21));
  }

  ctx.font = `${Math.round(mm(2.7))}px ${sans}`;
  ctx.fillText(
    `${CHARSET.length} characters · ${TEMPLATE_ROWS} rows · A4 — print at 100% scale, no "fit to page"`,
    mm(23),
    mm(TEMPLATE.pageHeightMm - 16.5)
  );

  // --- Cells ----------------------------------------------------------------
  const hair = Math.max(1, mm(0.18));
  const dash = [mm(0.9), mm(1.3)];

  for (const cell of templateCells()) {
    const x = mm(cell.x);
    const y = mm(cell.y);
    const w = mm(cell.w);
    const h = mm(cell.h);

    // Cell border
    ctx.strokeStyle = TEMPLATE.guideColorFaint;
    ctx.lineWidth = hair;
    ctx.setLineDash([]);
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));

    // Writing guides
    ctx.setLineDash(dash);
    ctx.strokeStyle = TEMPLATE.guideColorFaint;
    ctx.beginPath();
    for (const guide of [TEMPLATE.ascenderMm, TEMPLATE.xHeightMm, TEMPLATE.descenderMm]) {
      const gy = Math.round(y + mm(guide)) + 0.5;
      ctx.moveTo(x + mm(1), gy);
      ctx.lineTo(x + w - mm(1), gy);
    }
    ctx.stroke();

    // Baseline — the one guide that matters, so it is the strongest of the three
    ctx.setLineDash([mm(1.4), mm(1)]);
    ctx.strokeStyle = TEMPLATE.guideColor;
    ctx.lineWidth = Math.max(1, mm(0.3));
    ctx.beginPath();
    const by = Math.round(y + mm(TEMPLATE.baselineMm)) + 0.5;
    ctx.moveTo(x + mm(1), by);
    ctx.lineTo(x + w - mm(1), by);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label, in the strip above the writing area
    ctx.fillStyle = TEMPLATE.labelColor;
    ctx.font = `600 ${Math.round(mm(3.2))}px ${sans}`;
    ctx.fillText(cell.char, x + mm(1.6), y + mm(3.4));

    const hint = LABEL_HINTS[cell.char];
    if (hint) {
      ctx.font = `${Math.round(mm(2.1))}px ${sans}`;
      ctx.fillText(hint, x + mm(4.6), y + mm(3.4));
    }
  }

  return canvas;
}

/** Open the sheet in a new tab and trigger the print dialog. */
export function printTemplateSheet(options: TemplateSheetOptions = {}): boolean {
  const canvas = drawTemplateSheet({ dpi: 200, ...options });
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) return false;

  win.document.write(
    `<!doctype html><html><head><title>Handwriting capture sheet</title>` +
      `<style>@page{size:A4;margin:0}` +
      `html,body{margin:0;padding:0;background:#fff}` +
      `img{display:block;width:210mm;height:297mm}` +
      `</style></head><body><img src="${dataUrl}" alt="Handwriting capture sheet"></body></html>`
  );
  win.document.close();
  // Wait for the image to decode before printing, or the sheet prints blank.
  win.addEventListener('load', () => {
    win.focus();
    win.print();
  });
  return true;
}
