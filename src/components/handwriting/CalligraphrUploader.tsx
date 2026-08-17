'use client';

/**
 * Import glyphs from a filled-in Calligraphr sheet.
 *
 * Character identity is positional (their cells run in ASCII order), which makes
 * misalignment the dangerous failure: one wrong start character relabels the
 * whole page. So nothing is added to the profile until the user has seen a
 * preview of glyphs next to the labels they would receive and confirmed it.
 * The arrows re-run the assignment shifted by one, on the already-analysed
 * canvas, so fixing a misalignment is two clicks rather than a re-scan.
 */

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { importCalligraphrSheet, type CalligraphrResult } from '@/lib/handwriting/calligraphr';
import { imageToCanvas, loadImageFile } from '@/lib/handwriting/image';
import type { GlyphMap } from '@/lib/handwriting/types';

const MAX_EDGE = 2400;
const PREVIEW_COUNT = 10;

interface CalligraphrUploaderProps {
  onExtracted: (glyphs: GlyphMap, captured: string[], missing: string[]) => void;
}

export default function CalligraphrUploader({ onExtracted }: CalligraphrUploaderProps) {
  const [startChar, setStartChar] = useState('!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CalligraphrResult | null>(null);
  const [confirmedMsg, setConfirmedMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const analyze = async (canvas: HTMLCanvasElement, first: string) => {
    setBusy(true);
    setError(null);
    setConfirmedMsg(null);
    // Yield so the busy state paints before the synchronous pixel work.
    await new Promise((r) => setTimeout(r, 40));
    try {
      const result = importCalligraphrSheet(canvas, first);
      if (result.captured.length === 0) {
        setPending(null);
        setError(
          'The grid was read but no handwriting was found in it. Check that the ink is dark (black or blue) and the scan is not washed out.'
        );
        return;
      }
      setPending(result);
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : 'That sheet could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const img = await loadImageFile(file);
      const canvas = imageToCanvas(img, MAX_EDGE);
      canvasRef.current = canvas;
      await analyze(canvas, startChar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be read.');
    }
  };

  const shift = async (delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !pending) return;
    const next = String.fromCharCode(startChar.charCodeAt(0) + delta);
    setStartChar(next);
    await analyze(canvas, next);
  };

  const confirm = () => {
    if (!pending) return;
    onExtracted(pending.glyphs, pending.captured, []);
    const msg = [
      `Added ${pending.captured.length} characters to your letters.`,
      pending.nextChar ? `For the next page, the first character is set to "${pending.nextChar}".` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (pending.nextChar) setStartChar(pending.nextChar);
    setPending(null);
    canvasRef.current = null;
    setConfirmedMsg(msg);
  };

  const previews = pending
    ? pending.captured.slice(0, PREVIEW_COUNT).map((ch) => ({ ch, sample: pending.glyphs[ch][0] }))
    : [];

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
        starts at <span className="font-mono">!</span>; a later page starts wherever the previous one
        ended. You will see a preview before anything is added.
      </p>

      {pending && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-800">
            Check the labels before adding — does each letter match its tag?
          </div>
          <div className="flex flex-wrap gap-2">
            {previews.map(({ ch, sample }) => (
              <div key={ch} className="bg-white rounded-lg border border-gray-200 px-2 py-1.5 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.png}
                  alt={ch}
                  className="h-9 mx-auto"
                  style={{ imageRendering: 'auto' }}
                />
                <div className="text-[11px] font-mono font-bold text-violet-700 mt-1">{ch}</div>
              </div>
            ))}
          </div>
          {(pending.warnings.length > 0 || pending.blank.length > 0) && (
            <div className="text-xs text-gray-500">
              {pending.blank.length > 0 && `${pending.blank.length} blank cells. `}
              {pending.warnings.join(' ')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => shift(-1)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Labels are one ahead — shift them back"
            >
              <ArrowLeft size={13} /> Shift labels
            </button>
            <button
              onClick={() => shift(1)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Labels are one behind — shift them forward"
            >
              Shift labels <ArrowRight size={13} />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => {
                  setPending(null);
                  canvasRef.current = null;
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={13} /> Discard
              </button>
              <button
                onClick={confirm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
              >
                <Check size={13} /> Labels match — add {pending.captured.length} letters
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {confirmedMsg && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <Check size={16} className="flex-shrink-0 mt-0.5" />
          <span>{confirmedMsg}</span>
        </div>
      )}
    </div>
  );
}
