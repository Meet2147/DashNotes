/**
 * Server-side validation for handwriting profiles.
 *
 * Glyph payloads are user-supplied JSON containing base64 images, so they get
 * checked rather than trusted: unknown characters are dropped, numbers are
 * clamped to sane typographic ranges, and anything that is not a PNG data URL
 * is rejected. Kept free of DOM APIs so route handlers can import it.
 */

import { CHARSET, REQUIRED_CHARS } from './charset';
import { DEFAULT_METRICS, type GlyphMap, type GlyphSample, type HandwritingMetrics } from './types';

/** One glyph bitmap should be a few KB; 320KB is already far past plausible. */
const MAX_SAMPLE_BYTES = 320 * 1024;
/** A whole profile with three variants of every character stays well under this. */
export const MAX_PROFILE_BYTES = 12 * 1024 * 1024;
const MAX_SAMPLES_PER_CHAR = 4;

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

const ALLOWED_CHARS = new Set([...CHARSET, ' ']);

function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeSample(raw: unknown): GlyphSample | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const png = typeof s.png === 'string' ? s.png : '';
  if (!PNG_DATA_URL.test(png) || png.length > MAX_SAMPLE_BYTES) return null;

  const wEm = num(s.wEm, 0.001, 6, 0.5);
  const source = s.source === 'draw' || s.source === 'sheet' ? s.source : undefined;

  return {
    png,
    wEm,
    hEm: num(s.hEm, 0.001, 6, 0.5),
    leftEm: num(s.leftEm, -2, 2, DEFAULT_METRICS.sideBearing),
    topEm: num(s.topEm, -6, 4, -0.5),
    advanceEm: num(s.advanceEm, 0.01, 8, wEm + DEFAULT_METRICS.sideBearing * 2),
    source,
  };
}

export function sanitizeGlyphMap(raw: unknown): GlyphMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: GlyphMap = {};
  for (const [char, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_CHARS.has(char) || !Array.isArray(value)) continue;
    const samples = value
      .slice(0, MAX_SAMPLES_PER_CHAR)
      .map(sanitizeSample)
      .filter((s): s is GlyphSample => s !== null);
    if (samples.length > 0) out[char] = samples;
  }
  return out;
}

export function sanitizeMetrics(raw: unknown): HandwritingMetrics {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_METRICS };
  const m = raw as Record<string, unknown>;
  return {
    emMm: num(m.emMm, 1, 100, DEFAULT_METRICS.emMm),
    xHeight: num(m.xHeight, 0.15, 1, DEFAULT_METRICS.xHeight),
    descender: num(m.descender, 0, 1.5, DEFAULT_METRICS.descender),
    spaceAdvance: num(m.spaceAdvance, 0.05, 2, DEFAULT_METRICS.spaceAdvance),
    sideBearing: num(m.sideBearing, 0, 0.5, DEFAULT_METRICS.sideBearing),
  };
}

/**
 * Render settings are cosmetic, so rather than enumerate them we keep the JSON
 * small and strip anything that is not a primitive or a flat object of numbers.
 */
export function sanitizeSettings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.length > 40) continue;
    const t = typeof value;
    if (t === 'string') {
      out[key] = (value as string).slice(0, 64);
    } else if (t === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (t === 'boolean') {
      out[key] = value;
    } else if (value && t === 'object' && !Array.isArray(value)) {
      const nested: Record<string, number> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) nested[k] = v;
      }
      out[key] = nested;
    }
  }
  return out;
}

export function sanitizeName(raw: unknown, fallback = 'My Handwriting'): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Characters a profile still needs before it can render ordinary prose. */
export function missingRequired(glyphs: GlyphMap): string[] {
  return REQUIRED_CHARS.filter((c) => !glyphs[c] || glyphs[c].length === 0);
}

export function glyphCount(glyphs: GlyphMap): number {
  return Object.keys(glyphs).length;
}
