/**
 * Derived geometry shared by the paper drawer, the layout engine, and the
 * renderer. Building it once keeps the three in agreement about where the ruled
 * lines are — which matters, because the whole point is that the writing sits
 * *on* those lines rather than near them.
 */

import {
  DEFAULT_METRICS,
  DEFAULT_SETTINGS,
  PAGE_SIZES,
  type GlyphMap,
  type HandwritingMetrics,
  type Margins,
  type RenderSettings,
} from './types';

/**
 * How much of the line's height the x-height occupies. Measured off real
 * single-line notebooks: a comfortable hand fills a little under half the gap.
 */
const X_HEIGHT_OF_LINE = 0.42;

export interface RenderContext {
  settings: RenderSettings;
  metrics: HandwritingMetrics;
  glyphs: GlyphMap;
  pxPerMm: number;
  /** Pixel size of one em — every glyph dimension is a multiple of this. */
  emPx: number;
  lineSpacingPx: number;
  pageWidthPx: number;
  pageHeightPx: number;
  marginsPx: Margins;
  /** Y of every printed rule, top to bottom. */
  ruleYs: number[];
  /** Y of each rule text may sit on (all rules except the topmost). */
  baselineYs: number[];
  textLeftPx: number;
  textRightPx: number;
  /** How much horizontal room a line of text has. */
  lineWidthPx: number;
  /** 0 = machine-perfect, 1 = maximum wobble. Never quite reaches 0. */
  mess: number;
}

export function resolveSettings(overrides?: Partial<RenderSettings>): RenderSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(overrides ?? {}) };
  merged.margins = { ...DEFAULT_SETTINGS.margins, ...(overrides?.margins ?? {}) };
  return merged;
}

export function resolveMetrics(overrides?: Partial<HandwritingMetrics>): HandwritingMetrics {
  return { ...DEFAULT_METRICS, ...(overrides ?? {}) };
}

export function makeRenderContext(
  glyphs: GlyphMap,
  metricsIn: Partial<HandwritingMetrics> | undefined,
  settingsIn: Partial<RenderSettings> | undefined
): RenderContext {
  const settings = resolveSettings(settingsIn);
  const metrics = resolveMetrics(metricsIn);
  const page = PAGE_SIZES[settings.pageSize] ?? PAGE_SIZES.a4;

  const pxPerMm = settings.dpi / 25.4;
  const pageWidthPx = Math.round(page.widthMm * pxPerMm);
  const pageHeightPx = Math.round(page.heightMm * pxPerMm);
  const lineSpacingPx = settings.lineSpacingMm * pxPerMm;

  const marginsPx: Margins = {
    top: settings.margins.top * pxPerMm,
    right: settings.margins.right * pxPerMm,
    bottom: settings.margins.bottom * pxPerMm,
    left: settings.margins.left * pxPerMm,
  };

  // x-height drives the ink size, so changing the rule spacing rescales the
  // handwriting to match instead of leaving it floating.
  const xHeightPx = lineSpacingPx * X_HEIGHT_OF_LINE * settings.sizeScale;
  const emPx = xHeightPx / Math.max(0.2, metrics.xHeight);

  // Count rules in millimetres, not pixels: a preview at 110dpi and an export at
  // 300dpi must agree on how many lines fit, or pagination would shift between
  // what the user approved and what they downloaded.
  const usableHeightMm = page.heightMm - settings.margins.top - settings.margins.bottom;
  const ruleCount = Math.max(1, Math.floor(usableHeightMm / settings.lineSpacingMm + 1e-6));
  const ruleYs: number[] = [];
  for (let i = 0; i <= ruleCount; i++) ruleYs.push(marginsPx.top + i * lineSpacingPx);
  // The first rule has no room above it for ascenders, so writing starts on the
  // second. Very wide rule spacing on a heavily margined page can leave only one
  // rule, so fall back to writing on it rather than having nowhere to put text.
  const baselineYs = ruleYs.length > 1 ? ruleYs.slice(1) : [ruleYs[0] + lineSpacingPx];

  const textLeftPx = marginsPx.left;
  const textRightPx = pageWidthPx - marginsPx.right;

  return {
    settings,
    metrics,
    glyphs,
    pxPerMm,
    emPx,
    lineSpacingPx,
    pageWidthPx,
    pageHeightPx,
    marginsPx,
    ruleYs,
    baselineYs,
    textLeftPx,
    textRightPx,
    lineWidthPx: Math.max(emPx, textRightPx - textLeftPx),
    mess: Math.max(0.12, 1 - settings.neatness * 0.88),
  };
}
