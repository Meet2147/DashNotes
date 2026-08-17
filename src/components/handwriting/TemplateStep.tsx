'use client';

/**
 * The paper route: print the capture sheet, fill it in, photograph it, upload.
 *
 * The sheet is generated in the browser from the same geometry the extractor
 * reads, so there is no asset to keep in sync and no server round trip.
 */

import { useState } from 'react';
import { Printer, Download, AlertTriangle } from 'lucide-react';
import { CHARSET } from '@/lib/handwriting/charset';
import { canvasToBlob, downloadBlob } from '@/lib/handwriting/pdf';
import { drawTemplateSheet, printTemplateSheet } from '@/lib/handwriting/template';
import type { GlyphMap } from '@/lib/handwriting/types';
import CalligraphrUploader from './CalligraphrUploader';
import SheetUploader from './SheetUploader';

interface TemplateStepProps {
  onExtracted: (glyphs: GlyphMap, captured: string[], missing: string[]) => void;
  /**
   * Merge without navigating away. Calligraphr sheets span multiple pages, so
   * the importer stays on this step for the next upload instead of jumping to
   * review after the first one (which would also reset its page counter).
   */
  onImported: (glyphs: GlyphMap) => void;
}

export default function TemplateStep({ onExtracted, onImported }: TemplateStepProps) {
  const [error, setError] = useState<string | null>(null);

  const handlePrint = () => {
    setError(null);
    const opened = printTemplateSheet();
    if (!opened) {
      setError(
        'Your browser blocked the print window. Allow pop-ups for this site, or download the sheet as a PNG and print that.'
      );
    }
  };

  const handleDownload = async () => {
    setError(null);
    try {
      const canvas = drawTemplateSheet({ dpi: 200 });
      downloadBlob(await canvasToBlob(canvas, 'image/png'), 'dashnotes-handwriting-sheet.png');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The sheet could not be generated.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 p-5">
        <div className="text-sm font-bold text-gray-800 mb-3">1 · Get the sheet</div>
        <p className="text-sm text-gray-500 mb-4">
          One A4 page with a box for each of the {CHARSET.length} characters. Print it at 100% scale —
          if your printer shrinks the page to fit, the corner squares still work, so it will read fine
          either way.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            <Printer size={15} /> Print the sheet
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <Download size={15} /> Download as PNG
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5">
        <div className="text-sm font-bold text-gray-800 mb-3">2 · Fill it in</div>
        <ul className="text-sm text-gray-500 space-y-1.5 list-disc pl-5">
          <li>
            Use a <span className="font-medium text-gray-700">black or blue</span> pen, or a pencil.
            Avoid red and other warm colours — the sheet&apos;s printed guides are warm-toned so they can
            be filtered out, and red ink would be filtered out with them.
          </li>
          <li>Sit each character on its dotted baseline. Tails drop below it; tall letters rise above.</li>
          <li>Write at your natural size. Filling the whole box makes your handwriting look oversized.</li>
          <li>Keep every stroke inside its own box so neighbouring letters do not run together.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5">
        <div className="text-sm font-bold text-gray-800 mb-1">3 · Photograph and upload</div>
        <p className="text-sm text-gray-500 mb-4">
          Shoot the whole sheet from roughly overhead in even light — all four black corner squares must
          be visible. A slight angle is fine; the corners are used to flatten the perspective. The image
          is processed on this device and never uploaded.
        </p>
        <SheetUploader onExtracted={onExtracted} />
      </div>

      <div className="rounded-2xl border border-gray-200 p-5">
        <div className="text-sm font-bold text-gray-800 mb-1">
          Already filled in a Calligraphr sheet?
        </div>
        <p className="text-sm text-gray-500 mb-4">
          You can import it directly instead of writing everything again. The sheet&apos;s own grid
          is detected, so no corner squares are needed — just a flat scan.
        </p>
        <CalligraphrUploader onExtracted={(glyphs) => onImported(glyphs)} />
        <p className="text-xs text-gray-400 mt-3">
          Multi-page sheets: upload each page here, then open{' '}
          <span className="font-medium text-gray-600">Review</span> (step 3) to check every letter.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
