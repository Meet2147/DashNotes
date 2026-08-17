/**
 * The capture template: which characters we ask for, and exactly where every
 * cell sits on the printed sheet.
 *
 * Geometry lives here in millimetres and is shared by three consumers, so it has
 * to stay the single source of truth:
 *   1. template.ts  — draws the printable sheet
 *   2. extract.ts   — slices a rectified photo of that sheet back into glyphs
 *   3. OnScreenSheet — renders the same grid for stylus input
 *
 * Printed guides are drawn in a warm yellow rather than grey. Extraction
 * thresholds the *red* channel, where yellow reads as near-white and so
 * disappears completely, while black, blue, and pencil ink all read as dark.
 * That is what lets us pull clean glyphs off a phone photo without the printed
 * rules bleeding into the ink. The corner registration markers are black on
 * purpose — those we *do* want to find.
 */

export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const DIGITS = '0123456789'.split('');
export const PUNCTUATION = [
  '.', ',', "'", '"', '?', '!', ':', ';',
  '-', '(', ')', '/', '&', '%', '@', '#',
  '$', '*', '+', '=', '[', ']', '<', '>',
  '_', '~',
];

/** Every character the template asks for, in sheet order. */
export const CHARSET: string[] = [...LOWERCASE, ...UPPERCASE, ...DIGITS, ...PUNCTUATION];

/** Characters that must be present before a profile is considered usable. */
export const REQUIRED_CHARS: string[] = [...LOWERCASE, ...UPPERCASE, ...DIGITS, '.', ',', '?', '!', "'", '-'];

export interface CellRect {
  char: string;
  index: number;
  col: number;
  row: number;
  /** Cell origin (top-left) in template mm. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Template geometry, all in millimetres on an A4 sheet.
 *
 * Vertical layout inside one cell, measured from the cell's top edge:
 *
 *   0.0  ┌───────────────┐
 *        │ label strip   │
 *   4.5  ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
 *   6.5  │ ascender      │  <- tops of b d f h k l t and capitals
 *  11.5  │╌╌ x-height ╌╌ │  <- tops of a c e m n o r s
 *  16.5  │═══ baseline ══│
 *  20.5  │ descender     │  <- bottoms of g j p q y
 *  21.0  └───────────────┘
 *
 * emMm = baseline - ascender = 10mm, which is the unit all stored glyph
 * geometry is normalised against.
 */
export const TEMPLATE = {
  pageWidthMm: 210,
  pageHeightMm: 297,

  /** Black registration squares, used to undo perspective from a photo. */
  markerSizeMm: 9,
  markerCentresMm: [
    { x: 15, y: 15 },
    { x: 195, y: 15 },
    { x: 15, y: 282 },
    { x: 195, y: 282 },
  ] as const,

  gridOriginMm: { x: 23, y: 40 },
  cols: 8,
  cellWidthMm: 20.5,
  cellHeightMm: 21,

  labelStripMm: 4.5,
  ascenderMm: 6.5,
  xHeightMm: 11.5,
  baselineMm: 16.5,
  descenderMm: 20.5,

  /** Design em: baseline - ascender. */
  emMm: 10,

  /** Inset of the ink-extraction window inside each cell. */
  extractInsetXMm: 1,
  extractTopMm: 5.5,

  /** Resolution the sheet is rectified to before slicing, in px per mm. */
  rectifyPxPerMm: 10,

  /**
   * Ink colours on the printed sheet.
   *
   * Guides and cell borders sit inside the region we read ink from, so they must
   * be light enough in the red channel to fall under the extraction threshold —
   * anything at red >= ~225 disappears completely. The cell labels are darker
   * (and so readable) because they live in the label strip, 1.5mm above where
   * extraction starts. The markers are the only true black on the sheet.
   */
  guideColor: '#EFD49A',
  guideColorFaint: '#F8EAD0',
  labelColor: '#B5813A',
  headerColor: '#A87A32',
  markerColor: '#000000',
} as const;

export const TEMPLATE_ROWS = Math.ceil(CHARSET.length / TEMPLATE.cols);

/** Height of the whole grid in mm — used to sanity-check the sheet fits. */
export const TEMPLATE_GRID_HEIGHT_MM = TEMPLATE_ROWS * TEMPLATE.cellHeightMm;

/** Every cell on the sheet, with its position in template mm. */
export function templateCells(): CellRect[] {
  return CHARSET.map((char, index) => {
    const col = index % TEMPLATE.cols;
    const row = Math.floor(index / TEMPLATE.cols);
    return {
      char,
      index,
      col,
      row,
      x: TEMPLATE.gridOriginMm.x + col * TEMPLATE.cellWidthMm,
      y: TEMPLATE.gridOriginMm.y + row * TEMPLATE.cellHeightMm,
      w: TEMPLATE.cellWidthMm,
      h: TEMPLATE.cellHeightMm,
    };
  });
}

/**
 * Characters we can render even though the template never asks for them, by
 * falling back to a character we did capture. Keeps pasted prose from breaking
 * on smart quotes and dashes.
 */
const CHAR_ALIASES: Record<string, string> = {
  '‘': "'", // ‘
  '’': "'", // ’
  '‚': ',',
  '“': '"', // “
  '”': '"', // ”
  '–': '-', // –
  '—': '-', // —
  '−': '-', // −
  '\u00A0': ' ', // non-breaking space
  '•': '.', // bullet
  '·': '.', // middle dot
  '′': "'",
  '″': '"',
  '«': '"',
  '»': '"',
  '\\': '/',
  '{': '[',
  '}': ']',
  '|': '/',
  '`': "'",
  '^': '~',
};

/** Multi-character expansions applied before layout. */
const CHAR_EXPANSIONS: Record<string, string> = {
  '…': '...', // …
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '→': '->',
  '×': 'x',
};

/** Normalise text so layout only ever sees characters we might have captured. */
export function normalizeText(text: string): string {
  let out = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  for (const [from, to] of Object.entries(CHAR_EXPANSIONS)) {
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * Resolve a character to something the profile can actually draw.
 * Returns the glyph key plus a scale hint when we had to substitute a
 * different-sized letterform (lowercase standing in for a missing capital).
 */
export function resolveChar(
  char: string,
  has: (c: string) => boolean
): { key: string; scale: number } | null {
  if (has(char)) return { key: char, scale: 1 };

  const alias = CHAR_ALIASES[char];
  if (alias && has(alias)) return { key: alias, scale: 1 };

  // A missing capital can borrow its lowercase form, scaled up to cap height.
  const lower = char.toLowerCase();
  if (lower !== char && has(lower)) return { key: lower, scale: 1.45 };

  const upper = char.toUpperCase();
  if (upper !== char && has(upper)) return { key: upper, scale: 0.72 };

  return null;
}
