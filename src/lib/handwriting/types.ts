/**
 * Core types for the handwriting synthesis service.
 *
 * The pipeline is: capture a sheet of the user's own letterforms -> store each
 * glyph as a trimmed ink mask with typographic metrics -> re-lay those exact
 * masks out onto a ruled page for any typed text.
 *
 * All glyph geometry is stored in *em units*, where 1em is the design em of the
 * capture template (baseline to ascender line, see TEMPLATE.emMm). Storing in em
 * makes glyphs resolution independent: the renderer just picks a pixel size for
 * the em and multiplies.
 */

/** One captured instance of a single character. */
export interface GlyphSample {
  /** Trimmed ink mask as a PNG data URL. Black pixels, alpha = ink coverage. */
  png: string;
  /** Bitmap width in em units. */
  wEm: number;
  /** Bitmap height in em units. */
  hEm: number;
  /** Horizontal offset from the pen origin to the bitmap's left edge, in em. */
  leftEm: number;
  /** Vertical offset from the baseline to the bitmap's top edge, in em. Negative is above the baseline. */
  topEm: number;
  /** How far the pen advances after drawing this glyph, in em. */
  advanceEm: number;
  /** Which capture source produced this sample — useful for the review UI. */
  source?: 'sheet' | 'draw';
}

/** char -> one or more captured samples (multiple samples give natural variation). */
export type GlyphMap = Record<string, GlyphSample[]>;

export interface HandwritingMetrics {
  /** Design em in millimetres on the capture template. */
  emMm: number;
  /** x-height in em. */
  xHeight: number;
  /** Descender depth in em. */
  descender: number;
  /** Width of a space character, in em. */
  spaceAdvance: number;
  /** Default left/right side bearing applied to each glyph, in em. */
  sideBearing: number;
}

export const DEFAULT_METRICS: HandwritingMetrics = {
  emMm: 10,
  xHeight: 0.5,
  descender: 0.4,
  spaceAdvance: 0.3,
  sideBearing: 0.055,
};

export type PaperStyle = 'ruled' | 'ruled-margin' | 'college' | 'grid' | 'blank';
export type PageSizeName = 'a4' | 'letter';

export interface PageSize {
  name: PageSizeName;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAGE_SIZES: Record<PageSizeName, PageSize> = {
  a4: { name: 'a4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  letter: { name: 'letter', label: 'US Letter (8.5 × 11 in)', widthMm: 215.9, heightMm: 279.4 },
};

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RenderSettings {
  pageSize: PageSizeName;
  paper: PaperStyle;
  /** Distance between ruled lines, in mm. Text baselines sit on these lines. */
  lineSpacingMm: number;
  margins: Margins;
  /** Multiplier on the derived ink size. 1 = x-height is ~42% of the line spacing. */
  sizeScale: number;
  inkColor: string;
  /** Relative pen thickness. 1 = as captured. */
  penWidth: number;
  /** Extra slant in degrees applied to every glyph (positive leans right). */
  slantDeg: number;
  /** Multiplier on the space width. */
  wordSpacing: number;
  /** Extra tracking between glyphs, in em. */
  letterSpacing: number;
  /** 1 = machine-neat, 0 = maximum natural wobble. */
  neatness: number;
  /** Paragraph first-line indent, in em. */
  paragraphIndent: number;
  /** Blank ruled lines left before the first line of text. */
  firstLineOffset: number;
  /** Seed for all pseudo-random variation, so a page renders identically every time. */
  seed: number;
  dpi: number;
  ruleColor: string;
  marginLineColor: string;
  paperTint: string;
  /** 0 = clean paper, 1 = heavy fibre noise. */
  paperTexture: number;
}

export const DEFAULT_SETTINGS: RenderSettings = {
  pageSize: 'a4',
  paper: 'ruled-margin',
  lineSpacingMm: 8.5,
  margins: { top: 22, right: 14, bottom: 18, left: 26 },
  sizeScale: 1,
  inkColor: '#1B2A6B',
  penWidth: 1,
  slantDeg: 0,
  wordSpacing: 1,
  letterSpacing: 0,
  neatness: 0.55,
  paragraphIndent: 0,
  firstLineOffset: 0,
  seed: 20260817,
  dpi: 150,
  ruleColor: '#AFC6DF',
  marginLineColor: '#E2A0A8',
  paperTint: '#FDFDF8',
  paperTexture: 0.25,
};

/** Everything needed to render text in one person's hand. */
export interface HandwritingProfileData {
  glyphs: GlyphMap;
  metrics: HandwritingMetrics;
  settings: Partial<RenderSettings>;
}

export interface HandwritingProfile extends HandwritingProfileData {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Summary row returned by the list endpoint (no glyph payload — it is large). */
export interface HandwritingProfileSummary {
  id: string;
  name: string;
  isDefault: boolean;
  glyphCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A single glyph placed on a page by the layout engine. */
export interface PlacedGlyph {
  char: string;
  sample: GlyphSample;
  /** Left edge of the glyph bitmap, in page px. */
  x: number;
  /** Top edge of the glyph bitmap, in page px. */
  y: number;
  w: number;
  h: number;
  /** The baseline this glyph sits on, in page px. Rotation and slant pivot here. */
  baselineY: number;
  /** Rotation in radians, about the glyph's baseline centre. */
  rotation: number;
  /** Horizontal shear in radians (slant). */
  slant: number;
  /** Ink opacity for this glyph, simulating pen pressure. */
  alpha: number;
}

export interface LaidOutLine {
  glyphs: PlacedGlyph[];
  baselineY: number;
}

export interface LaidOutPage {
  lines: LaidOutLine[];
}

export interface LayoutResult {
  pages: LaidOutPage[];
  /** Characters in the text that the profile has no glyph for. */
  missing: string[];
  widthPx: number;
  heightPx: number;
}
