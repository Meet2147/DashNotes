/**
 * Lays typed text out as individual glyph placements on ruled pages.
 *
 * Two passes:
 *   1. Measure — resolve each character to a captured sample and total up word
 *      widths, then break lines greedily against the page's text column.
 *   2. Place — walk the chosen lines and give every glyph its final position,
 *      with the small imperfections that make a page read as handwritten:
 *      per-glyph size and rotation jitter, a slow baseline wander, and a slight
 *      slope across each line.
 *
 * All variation is drawn from a seeded generator, so the same text and settings
 * always produce exactly the page the user previewed.
 */

import { normalizeText, resolveChar } from './charset';
import type { RenderContext } from './context';
import { hashString, jitter, jitterSoft, makeRng, pick } from './rng';
import type {
  GlyphSample,
  LaidOutLine,
  LaidOutPage,
  LayoutResult,
  PlacedGlyph,
} from './types';

interface MeasuredGlyph {
  char: string;
  sample: GlyphSample;
  /** Scale correction when a substitute letterform stood in (see resolveChar). */
  scale: number;
  /** Un-jittered advance in px. */
  advance: number;
}

interface PlannedLine {
  glyphs: MeasuredGlyph[];
  indent: number;
}

/**
 * Placement adds a little randomness to each advance, so a long line can drift
 * slightly past what measuring predicted. Hold back a fraction of an em to keep
 * that drift from ever crossing the right margin.
 */
const WRAP_SAFETY_EM = 0.4;

export function layoutText(text: string, rc: RenderContext): LayoutResult {
  const { settings, metrics, glyphs, emPx } = rc;
  const has = (c: string) => Array.isArray(glyphs[c]) && glyphs[c].length > 0;

  const sampleRng = makeRng(settings.seed >>> 0);
  const missing = new Set<string>();

  const measureChar = (char: string): MeasuredGlyph | null => {
    const resolved = resolveChar(char, has);
    if (!resolved) {
      missing.add(char);
      return null;
    }
    const sample = pick(sampleRng, glyphs[resolved.key]);
    const advance =
      sample.advanceEm * emPx * resolved.scale + settings.letterSpacing * emPx;
    return { char, sample, scale: resolved.scale, advance };
  };

  const spaceAdvance = metrics.spaceAdvance * emPx * settings.wordSpacing;
  const usableWidth = rc.lineWidthPx - WRAP_SAFETY_EM * emPx;
  const indentPx = settings.paragraphIndent * emPx;

  // ---- Pass 1: measure and break lines -----------------------------------

  const planned: PlannedLine[] = [];
  const paragraphs = normalizeText(text).split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      planned.push({ glyphs: [], indent: 0 });
      continue;
    }

    let current: MeasuredGlyph[] = [];
    let currentWidth = 0;
    let isFirstLine = true;
    let pendingSpaces = 0;

    const lineBudget = () => usableWidth - (isFirstLine ? indentPx : 0);

    const flush = () => {
      planned.push({ glyphs: current, indent: isFirstLine ? indentPx : 0 });
      current = [];
      currentWidth = 0;
      pendingSpaces = 0;
      isFirstLine = false;
    };

    // Split into words and the runs of spaces between them.
    const tokens = paragraph.split(/( +)/).filter((t) => t.length > 0);

    for (const token of tokens) {
      if (token[0] === ' ') {
        // Spaces are only committed once we know a word follows on this line.
        if (current.length > 0) pendingSpaces += token.length;
        continue;
      }

      let word = token
        .split('')
        .map(measureChar)
        .filter((g): g is MeasuredGlyph => g !== null);
      if (word.length === 0) continue;

      const wordWidth = word.reduce((sum, g) => sum + g.advance, 0);
      const gapWidth = pendingSpaces * spaceAdvance;

      if (current.length > 0 && currentWidth + gapWidth + wordWidth > lineBudget()) {
        flush();
      }

      if (current.length === 0 && wordWidth > lineBudget()) {
        // A single word too long for the column (a URL, a long chemical name):
        // break it across lines rather than letting it run into the margin.
        while (word.length > 0) {
          let taken = 0;
          let width = 0;
          while (taken < word.length && width + word[taken].advance <= lineBudget()) {
            width += word[taken].advance;
            taken++;
          }
          if (taken === 0) taken = 1; // always make progress
          current = word.slice(0, taken);
          currentWidth = width;
          word = word.slice(taken);
          if (word.length > 0) flush();
        }
        pendingSpaces = 0;
        continue;
      }

      if (current.length > 0 && pendingSpaces > 0) {
        const spacer = spaceGlyph(pendingSpaces * spaceAdvance);
        current.push(spacer);
        currentWidth += spacer.advance;
        pendingSpaces = 0;
      }
      current.push(...word);
      currentWidth += wordWidth;
    }

    flush();
  }

  // ---- Pass 2: place glyphs onto ruled lines ------------------------------

  const linesPerPage = Math.max(1, rc.baselineYs.length - settings.firstLineOffset);
  const pages: LaidOutPage[] = [];
  let page: LaidOutPage = { lines: [] };
  const jitterRng = makeRng((settings.seed ^ 0x9e3779b9) >>> 0);

  planned.forEach((line, globalLineIndex) => {
    if (page.lines.length >= linesPerPage) {
      pages.push(page);
      page = { lines: [] };
    }
    const slot = page.lines.length + settings.firstLineOffset;
    const baselineY = rc.baselineYs[Math.min(slot, rc.baselineYs.length - 1)];

    page.lines.push(
      placeLine(line, baselineY, rc, jitterRng, globalLineIndex)
    );
  });

  if (page.lines.length > 0 || pages.length === 0) pages.push(page);

  return {
    pages,
    missing: Array.from(missing),
    widthPx: rc.pageWidthPx,
    heightPx: rc.pageHeightPx,
  };
}

/** A zero-ink glyph that just moves the pen — used for inter-word gaps. */
function spaceGlyph(advance: number): MeasuredGlyph {
  return {
    char: ' ',
    sample: { png: '', wEm: 0, hEm: 0, leftEm: 0, topEm: 0, advanceEm: 0 },
    scale: 1,
    advance,
  };
}

function placeLine(
  line: PlannedLine,
  baselineY: number,
  rc: RenderContext,
  rng: () => number,
  lineIndex: number
): LaidOutLine {
  const { emPx, mess, settings } = rc;
  const placed: PlacedGlyph[] = [];

  // Per-line character: a slight overall slope plus a slow wander, both of which
  // a real hand has and a typeface never does.
  const lineRng = makeRng(hashString(`line:${settings.seed}:${lineIndex}`));
  const slope = jitterSoft(lineRng, 0.008) * mess;
  const wanderAmp = 0.02 * emPx * mess;
  const wanderPhase = lineRng() * Math.PI * 2;
  const wanderPeriod = Math.max(emPx * 4, rc.lineWidthPx / (1.2 + lineRng() * 1.6));

  const startX = rc.textLeftPx + line.indent;
  let penX = startX;
  const slantRad = (settings.slantDeg * Math.PI) / 180;

  for (const g of line.glyphs) {
    if (g.char === ' ' || g.sample.png === '') {
      penX += g.advance;
      continue;
    }

    const sizeJit = 1 + jitterSoft(rng, 0.04 * mess);
    const w = g.sample.wEm * emPx * g.scale * sizeJit;
    const h = g.sample.hEm * emPx * g.scale * sizeJit;

    const travelled = penX - startX;
    const drift =
      slope * travelled + wanderAmp * Math.sin(wanderPhase + (travelled / wanderPeriod) * Math.PI * 2);
    const glyphBaseline = baselineY + drift + jitterSoft(rng, 0.05 * emPx * mess);

    placed.push({
      char: g.char,
      sample: g.sample,
      x: penX + g.sample.leftEm * emPx * g.scale + jitter(rng, 0.012 * emPx * mess),
      y: glyphBaseline + g.sample.topEm * emPx * g.scale * sizeJit,
      w,
      h,
      baselineY: glyphBaseline,
      rotation: (jitterSoft(rng, 2.1 * mess) * Math.PI) / 180,
      slant: slantRad,
      alpha: Math.min(1, 0.87 + rng() * 0.15),
    });

    penX += g.advance * sizeJit + jitter(rng, 0.012 * emPx * mess);
  }

  return { glyphs: placed, baselineY };
}

/** Rough page count without doing full placement — used for live UI hints. */
export function estimatePageCount(text: string, rc: RenderContext): number {
  return layoutText(text, rc).pages.length;
}
