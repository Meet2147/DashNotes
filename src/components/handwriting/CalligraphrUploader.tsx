'use client';

/**
 * Import glyphs from a filled-in Calligraphr sheet, so work already done on
 * their templates is not wasted.
 *
 * Character identity is positional (Calligraphr's cells run in ASCII order), so
 * the user tells us the first character on the page and can import multiple
 * pages one after another — the field advances itself between pages. Everything
 * still funnels through the review grid before a profile can be saved.
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { importCalligraphrSheet } from '@/lib/handwriting/calligraphr';
import { imageToCanvas, loadImageFile } from '@/lib/handwriting/image';
import type { GlyphMap } from '@/lib/handwriting/types';

const MAX_EDGE = 2400;

interface CalligraphrUploaderProps {
  onExtracted: (glyphs: GlyphMap, captured: string[], missing: string[]) => void;
}

export default function CalligraphrUploader({ onExtracted }: CalligraphrUploaderProps) {
  const [startChar, setStartChar] = useState('!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const img = await loadImageFile(file);
      const canvas = imageToCanvas(img, MAX_EDGE);
      // Yield so the busy state paints before the synchronous work.
      await new Promise((r) => setTimeout(r, 40));
      const result = importCalligraphrSheet(canvas, startChar);

      if (result.captured.length === 0) {
        setError(
          'The grid was read but no handwriting was found in it. Check that the ink is dark (black or blue) and the scan is not washed out.'
        );
        return;
      }

      const parts = [
        `Imported ${result.captured.length} characters (${result.captured[0]} … ${result.captured[result.captured.length - 1]}).`,
      ];
      if (result.blank.length > 0) parts.push(`${result.blank.length} cells were blank.`);
      if (result.unsupported.length > 0) {
        parts.push(`Skipped unsupported: ${result.unsupported.join(' ')}.`);
      }
      parts.push(...result.warnings);
      if (result.nextChar) {
        parts.push(`For the next page, the first character is set to "${result.nextChar}".`);
        setStartChar(result.nextChar);
      }
      setSummary(parts.join(' '));
      onExtracted(result.glyphs, result.captured, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That sheet could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-500 mb-1.5">
            First character on this page
          </span>
          <input
            type="text"
            value={startChar}
            onChange={(e) => setStartChar(e.target.value.slice(-1))}
            maxLength={2}
            className="w-20 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </label>
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {busy ? 'Reading the sheet…' : 'Upload Calligraphr page'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <p className="text-xs text-gray-400">
        Works with flat scans (PNG or JPG — export PDFs as images first). Their standard template
        starts at <span className="font-mono">!</span>; for a later page, enter whatever character
        its first cell shows. Character identity comes from cell order, so check the review grid
        after importing — any mislabelled letter can be redrawn there.
      </p>

      {error && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {summary && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
          <span>{summary}</span>
        </div>
      )}
    </div>
  );
}
