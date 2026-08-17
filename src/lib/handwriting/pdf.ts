/**
 * A minimal, dependency-free PDF writer.
 *
 * We only ever need one thing from PDF: a fixed number of pages, each holding a
 * single full-bleed raster of a rendered sheet. That is a few hundred bytes of
 * object plumbing around JPEG data the browser already produced for us, so
 * pulling in a PDF library would be several hundred kilobytes for no gain.
 *
 * JPEG bytes go in untouched via the DCTDecode filter — no re-encoding, so the
 * exported file is exactly the quality the canvas produced.
 */

const PT_PER_MM = 72 / 25.4;

export interface PdfPageImage {
  jpeg: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The page could not be encoded.'))),
      type,
      quality
    );
  });
}

export async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality = 0.92
): Promise<PdfPageImage> {
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  const buf = await blob.arrayBuffer();
  return {
    jpeg: new Uint8Array(buf),
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
  };
}

function ascii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function pad10(n: number): string {
  const s = String(n);
  return s.length >= 10 ? s : '0'.repeat(10 - s.length) + s;
}

/**
 * Assemble the PDF. Every page gets three objects (page, content stream, image),
 * numbered after the catalog and page tree.
 */
export function buildPdf(
  pages: PdfPageImage[],
  pageWidthMm: number,
  pageHeightMm: number
): Blob {
  if (pages.length === 0) throw new Error('Nothing to export.');

  const wPt = +(pageWidthMm * PT_PER_MM).toFixed(2);
  const hPt = +(pageHeightMm * PT_PER_MM).toFixed(2);

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = []; // offsets[objNumber] = byte offset

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? ascii(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };

  const startObject = (num: number) => {
    offsets[num] = offset;
    push(`${num} 0 obj\n`);
  };

  push('%PDF-1.4\n');
  // Binary comment so tools treat the file as binary rather than mangling newlines.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageObjNum = (i: number) => 3 + i * 3;
  const contentObjNum = (i: number) => 3 + i * 3 + 1;
  const imageObjNum = (i: number) => 3 + i * 3 + 2;
  const totalObjects = 2 + pages.length * 3;

  // 1: catalog
  startObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: page tree
  startObject(2);
  const kids = pages.map((_, i) => `${pageObjNum(i)} 0 R`).join(' ');
  push(`<< /Type /Pages /Count ${pages.length} /Kids [ ${kids} ] >>\nendobj\n`);

  pages.forEach((page, i) => {
    startObject(pageObjNum(i));
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] ` +
        `/Resources << /XObject << /Im0 ${imageObjNum(i)} 0 R >> >> ` +
        `/Contents ${contentObjNum(i)} 0 R >>\nendobj\n`
    );

    // Scale the unit image square up to fill the page.
    const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q\n`;
    startObject(contentObjNum(i));
    push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    startObject(imageObjNum(i));
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${page.jpeg.length} >>\nstream\n`
    );
    push(page.jpeg);
    push('\nendstream\nendobj\n');
  });

  const xrefOffset = offset;
  push(`xref\n0 ${totalObjects + 1}\n`);
  push('0000000000 65535 f \n');
  for (let num = 1; num <= totalObjects; num++) {
    push(`${pad10(offsets[num] ?? 0)} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

/** Render canvases straight to a downloadable PDF. */
export async function canvasesToPdf(
  canvases: HTMLCanvasElement[],
  pageWidthMm: number,
  pageHeightMm: number,
  quality = 0.92
): Promise<Blob> {
  const images: PdfPageImage[] = [];
  for (const canvas of canvases) {
    images.push(await canvasToJpegBytes(canvas, quality));
  }
  return buildPdf(images, pageWidthMm, pageHeightMm);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Filesystem-safe stem for a downloaded file. */
export function safeFilename(name: string, fallback = 'handwriting'): string {
  const cleaned = name
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : fallback;
}
