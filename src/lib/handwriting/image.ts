/**
 * Dependency-free image processing for the capture pipeline.
 *
 * Everything here runs in the browser on a canvas-derived ImageData, so a
 * user's handwriting photo never leaves their machine until they save the
 * finished profile.
 *
 * The one trick worth knowing: we work on the *red* channel, not luminance.
 * The printed template draws its rules, boxes, and labels in a warm yellow,
 * which is bright in red and therefore invisible after thresholding, while
 * black/blue/pencil ink is dark in red and survives. That removes the whole
 * class of "the printed line got merged into the letter" failures without
 * needing to detect and subtract the guides.
 */

export interface GrayImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Component {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  label: number;
}

/** Pull the red channel out of RGBA pixels, compositing over white. */
export function redChannel(img: ImageData): GrayImage {
  const { width, height, data } = img;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const a = data[p + 3];
    // Transparent regions (e.g. a PNG screenshot) read as paper, not ink.
    out[i] = a === 255 ? data[p] : Math.round((data[p] * a + 255 * (255 - a)) / 255);
  }
  return { data: out, width, height };
}

/** Perceptual grey, for previews where colour fidelity does not matter. */
export function luminance(img: ImageData): GrayImage {
  const { width, height, data } = img;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  return { data: out, width, height };
}

/**
 * Summed-area table. Int32 is safe here: 255 * 4096 * 4096 still fits.
 * Dimensions are (width + 1) x (height + 1) so window sums need no bounds checks.
 */
export function integralImage(img: GrayImage): Int32Array {
  const { width: w, height: h, data } = img;
  const sum = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const inRow = y * w;
    const outRow = (y + 1) * (w + 1);
    const prevRow = y * (w + 1);
    for (let x = 0; x < w; x++) {
      rowSum += data[inRow + x];
      sum[outRow + x + 1] = sum[prevRow + x + 1] + rowSum;
    }
  }
  return sum;
}

/**
 * Local-mean adaptive threshold that returns ink *coverage* (0-255) rather than
 * a hard bitmap, so glyph edges keep their antialiasing and print smoothly.
 *
 * `radius` is the half-window in px; `delta` is how much darker than the local
 * background a pixel must be before it counts as ink at all.
 */
export function inkCoverage(img: GrayImage, radius: number, delta: number): Uint8ClampedArray {
  const { width: w, height: h, data } = img;
  const sum = integralImage(img);
  const out = new Uint8ClampedArray(w * h);
  const stride = w + 1;

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const total =
        sum[(y1 + 1) * stride + (x1 + 1)] -
        sum[y0 * stride + (x1 + 1)] -
        sum[(y1 + 1) * stride + x0] +
        sum[y0 * stride + x0];
      const mean = total / count;
      const v = data[y * w + x];
      const threshold = mean - delta;
      if (v >= threshold) continue;
      // Full opacity once the pixel is clearly darker than its surroundings.
      const ramp = Math.max(14, mean * 0.5);
      out[y * w + x] = Math.min(255, ((threshold - v) / ramp) * 255);
    }
  }
  return out;
}

/** Otsu's method, used as a fallback when adaptive thresholding is overkill. */
export function otsuThreshold(img: GrayImage): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < img.data.length; i++) hist[img.data[i]]++;
  const total = img.data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

/**
 * 8-connected component labelling over a coverage map.
 * Returns the components at or above `minArea` plus the label image, so callers
 * can keep only the pixels that belong to an accepted component.
 */
export function connectedComponents(
  coverage: Uint8ClampedArray,
  width: number,
  height: number,
  inkAt: number,
  minArea: number
): { components: Component[]; labels: Int32Array } {
  const labels = new Int32Array(width * height);
  const components: Component[] = [];
  const stack: number[] = [];
  let nextLabel = 0;

  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== 0 || coverage[start] < inkAt) continue;

    nextLabel++;
    const label = nextLabel;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;

    labels[start] = label;
    stack.push(start);

    while (stack.length > 0) {
      const idx = stack.pop() as number;
      const x = idx % width;
      const y = (idx - x) / width;

      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const xLo = x > 0 ? x - 1 : 0;
      const xHi = x < width - 1 ? x + 1 : width - 1;
      const yLo = y > 0 ? y - 1 : 0;
      const yHi = y < height - 1 ? y + 1 : height - 1;
      for (let ny = yLo; ny <= yHi; ny++) {
        const row = ny * width;
        for (let nx = xLo; nx <= xHi; nx++) {
          const n = row + nx;
          if (labels[n] === 0 && coverage[n] >= inkAt) {
            labels[n] = label;
            stack.push(n);
          }
        }
      }
    }

    if (area >= minArea) {
      components.push({ area, minX, minY, maxX, maxY, cx: sumX / area, cy: sumY / area, label });
    } else {
      // Too small to be ink — erase it so callers see a clean map.
      components.push({ area, minX, minY, maxX, maxY, cx: sumX / area, cy: sumY / area, label: -label });
    }
  }

  return { components, labels };
}

/**
 * Solve for the 3x3 projective transform H with `to = H * from`, given four
 * point correspondences. h22 is fixed at 1, leaving an 8x8 linear system that
 * we clear with Gaussian elimination and partial pivoting.
 */
export function computeHomography(from: Point[], to: Point[]): number[] | null {
  if (from.length !== 4 || to.length !== 4) return null;

  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    if (pivot !== col) {
      const tmpRow = a[pivot];
      a[pivot] = a[col];
      a[col] = tmpRow;
      const tmpB = b[pivot];
      b[pivot] = b[col];
      b[col] = tmpB;
    }
    const pv = a[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = a[r][col] / pv;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) a[r][c] -= factor * a[col][c];
      b[r] -= factor * b[col];
    }
  }

  const h = new Array<number>(9).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let acc = b[r];
    for (let c = r + 1; c < n; c++) acc -= a[r][c] * h[c];
    h[r] = acc / a[r][r];
  }
  h[8] = 1;
  return h;
}

export function applyHomography(h: number[], x: number, y: number): Point {
  const denom = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / denom,
    y: (h[3] * x + h[4] * y + h[5]) / denom,
  };
}

function sampleBilinear(img: GrayImage, x: number, y: number): number {
  const { width: w, height: h, data } = img;
  if (x < -1 || y < -1 || x > w || y > h) return 255; // outside the photo reads as paper
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const cx0 = Math.min(w - 1, Math.max(0, x0));
  const cy0 = Math.min(h - 1, Math.max(0, y0));
  const cx1 = Math.min(w - 1, Math.max(0, x0 + 1));
  const cy1 = Math.min(h - 1, Math.max(0, y0 + 1));
  const p00 = data[cy0 * w + cx0];
  const p10 = data[cy0 * w + cx1];
  const p01 = data[cy1 * w + cx0];
  const p11 = data[cy1 * w + cx1];
  const top = p00 + (p10 - p00) * fx;
  const bottom = p01 + (p11 - p01) * fx;
  return top + (bottom - top) * fy;
}

/**
 * Rectify the photo: for each pixel of the flat output, look up where it came
 * from in the original via `h` (which must map output space -> source space)
 * and sample there.
 */
export function warpPerspective(
  src: GrayImage,
  h: number[],
  outWidth: number,
  outHeight: number
): GrayImage {
  const out = new Uint8ClampedArray(outWidth * outHeight);
  for (let y = 0; y < outHeight; y++) {
    const row = y * outWidth;
    for (let x = 0; x < outWidth; x++) {
      const p = applyHomography(h, x, y);
      out[row + x] = sampleBilinear(src, p.x, p.y);
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}

/**
 * Locate the four black registration squares.
 *
 * Candidates must be solid (high fill ratio), roughly square even under
 * perspective, and small relative to the page. We then take the candidate
 * furthest into each corner and sanity-check the resulting quad's aspect ratio
 * against the template's. Returns null rather than guessing — the UI falls back
 * to letting the user drag the corners into place.
 */
export function findRegistrationMarkers(
  img: GrayImage,
  expectedAspect: number
): Point[] | null {
  const minDim = Math.min(img.width, img.height);
  const radius = Math.max(12, Math.round(minDim * 0.05));
  const coverage = inkCoverage(img, radius, 18);

  const minSide = Math.max(6, minDim * 0.012);
  const maxSide = minDim * 0.24;
  const { components } = connectedComponents(
    coverage,
    img.width,
    img.height,
    110,
    Math.round(minSide * minSide * 0.5)
  );

  const candidates = components.filter((c) => {
    if (c.label < 0) return false;
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    if (bw < minSide || bh < minSide || bw > maxSide || bh > maxSide) return false;
    const aspect = bw / bh;
    if (aspect < 0.6 || aspect > 1.65) return false;
    return c.area / (bw * bh) >= 0.72;
  });

  if (candidates.length < 4) return null;

  // Corner-most candidate in each direction, scored by x±y so perspective and
  // an off-centre page both still resolve sensibly.
  const score = [
    (p: Component) => p.cx + p.cy, // top-left: minimise
    (p: Component) => -p.cx + p.cy, // top-right: minimise
    (p: Component) => p.cx - p.cy, // bottom-left: minimise
    (p: Component) => -p.cx - p.cy, // bottom-right: minimise
  ];

  const chosen: Component[] = [];
  for (const fn of score) {
    let best = candidates[0];
    let bestVal = fn(best);
    for (const c of candidates) {
      const v = fn(c);
      if (v < bestVal) {
        bestVal = v;
        best = c;
      }
    }
    chosen.push(best);
  }

  // All four must be distinct, otherwise we picked the same blob repeatedly.
  const unique = new Set(chosen.map((c) => c.label));
  if (unique.size !== 4) return null;

  const pts = chosen.map((c) => ({ x: c.cx, y: c.cy }));
  const topWidth = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const leftHeight = Math.hypot(pts[2].x - pts[0].x, pts[2].y - pts[0].y);
  if (topWidth < minDim * 0.2 || leftHeight < minDim * 0.2) return null;

  const aspect = topWidth / leftHeight;
  if (aspect < expectedAspect * 0.6 || aspect > expectedAspect * 1.7) return null;

  return pts;
}

/** Tight bounding box of ink inside a sub-rectangle, or null when empty. */
export function inkBounds(
  coverage: Uint8ClampedArray,
  width: number,
  rect: { x: number; y: number; w: number; h: number },
  inkAt: number
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    const row = y * width;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (coverage[row + x] >= inkAt) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/** Fit an ImageData-bearing canvas, downscaling so the long edge is at most `maxEdge`. */
export function imageToCanvas(
  source: HTMLImageElement | ImageBitmap,
  maxEdge: number
): HTMLCanvasElement {
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Decode a File into an image element. */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}
