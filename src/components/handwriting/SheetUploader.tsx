'use client';

/**
 * Upload a photo or scan of a filled-in capture sheet and pull the glyphs out.
 *
 * Corner detection is automatic, but always adjustable: the four handles are the
 * escape hatch that makes this route reliable rather than merely usually-working.
 * If a shadow or a folded corner defeats detection, the user drags the handles
 * onto the black squares and extraction becomes exact again.
 *
 * Everything runs locally in the browser — the photo is never uploaded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Crosshair, Loader2, ScanLine, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CHARSET } from '@/lib/handwriting/charset';
import { detectCorners, extractGlyphs } from '@/lib/handwriting/extract';
import { imageToCanvas, loadImageFile, type Point } from '@/lib/handwriting/image';
import type { GlyphMap } from '@/lib/handwriting/types';

/** Cap the working resolution: bigger inputs cost time without helping accuracy. */
const MAX_EDGE = 2400;

const HANDLE_LABELS = ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'];

interface SheetUploaderProps {
  onExtracted: (glyphs: GlyphMap, captured: string[], missing: string[]) => void;
}

export default function SheetUploader({ onExtracted }: SheetUploaderProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  /**
   * The working canvas lives in a ref (it is a mutable DOM object, not render
   * data) but its dimensions are needed during render to place the corner
   * handles, so they are mirrored into state.
   */
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(null);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [busy, setBusy] = useState<'loading' | 'extracting' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ captured: number; missing: string[] } | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<number | null>(null);

  const reset = () => {
    sourceCanvasRef.current = null;
    setSourceUrl(null);
    setSourceSize(null);
    setCorners(null);
    setResult(null);
    setError(null);
  };

  const handleFile = async (file: File) => {
    setBusy('loading');
    setError(null);
    setResult(null);
    try {
      const img = await loadImageFile(file);
      const canvas = imageToCanvas(img, MAX_EDGE);
      sourceCanvasRef.current = canvas;
      setSourceUrl(canvas.toDataURL('image/jpeg', 0.9));
      setSourceSize({ w: canvas.width, h: canvas.height });

      const detected = detectCorners(canvas);
      setCorners(detected.points);
      setAutoDetected(detected.auto);
      if (!detected.auto) {
        setError(
          'The four black corner squares were not found automatically. Drag each handle onto the middle of its corner square, then extract.'
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be read.');
    } finally {
      setBusy(null);
    }
  };

  const runExtraction = async () => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !corners) return;
    setBusy('extracting');
    setError(null);
    // Let the browser paint the busy state before the synchronous work starts.
    await new Promise((r) => setTimeout(r, 40));
    try {
      const out = extractGlyphs(canvas, corners);
      setResult({ captured: out.captured.length, missing: out.missing });
      onExtracted(out.glyphs, out.captured, out.missing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed.');
    } finally {
      setBusy(null);
    }
  };

  // ---- Corner handle dragging ---------------------------------------------

  const moveHandle = useCallback((clientX: number, clientY: number) => {
    const index = dragRef.current;
    const frame = frameRef.current;
    const canvas = sourceCanvasRef.current;
    if (index === null || !frame || !canvas) return;
    const rect = frame.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    setCorners((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[index] = {
        x: Math.max(0, Math.min(canvas.width, x)),
        y: Math.max(0, Math.min(canvas.height, y)),
      };
      return next;
    });
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragRef.current === null) return;
      e.preventDefault();
      moveHandle(e.clientX, e.clientY);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [moveHandle]);

  return (
    <div className="space-y-4">
      {!sourceUrl && (
        <label className="flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-2xl border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/40 transition-colors cursor-pointer text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
            {busy === 'loading' ? (
              <Loader2 size={22} className="text-violet-500 animate-spin" />
            ) : (
              <Upload size={22} className="text-violet-500" />
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-800">Upload your filled-in sheet</div>
            <div className="text-sm text-gray-500 mt-1">
              A photo or a scan. Include all four black corner squares.
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {sourceUrl && sourceSize && corners && (
        <>
          <div className="flex items-center gap-2 text-sm">
            {autoDetected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                <Crosshair size={13} /> Corners found automatically
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium">
                <Crosshair size={13} /> Position the corners by hand
              </span>
            )}
            <span className="text-gray-400">Drag any handle to fine-tune.</span>
          </div>

          <div
            ref={frameRef}
            className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 select-none touch-none"
            style={{ aspectRatio: `${sourceSize.w} / ${sourceSize.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sourceUrl} alt="Uploaded handwriting sheet" className="w-full h-full object-contain" draggable={false} />

            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${sourceSize.w} ${sourceSize.h}`}
              preserveAspectRatio="none"
            >
              <polygon
                points={`${corners[0].x},${corners[0].y} ${corners[1].x},${corners[1].y} ${corners[3].x},${corners[3].y} ${corners[2].x},${corners[2].y}`}
                fill="rgba(139,92,246,0.12)"
                stroke="#8B5CF6"
                strokeWidth={Math.max(2, sourceSize.w * 0.0025)}
              />
            </svg>

            {corners.map((corner, i) => (
              <button
                key={i}
                title={HANDLE_LABELS[i]}
                onPointerDown={(e) => {
                  e.preventDefault();
                  dragRef.current = i;
                }}
                className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-white bg-violet-600 shadow-lg cursor-grab active:cursor-grabbing touch-none"
                style={{
                  left: `${(corner.x / sourceSize.w) * 100}%`,
                  top: `${(corner.y / sourceSize.h) * 100}%`,
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runExtraction}
              disabled={busy !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {busy === 'extracting' ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Reading your handwriting…
                </>
              ) : (
                <>
                  <ScanLine size={15} /> Extract glyphs
                </>
              )}
            </button>
            <button
              onClick={reset}
              disabled={busy !== null}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Use a different image
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">
              Read {result.captured} of {CHARSET.length} characters.
            </div>
            {result.missing.length > 0 && (
              <div className="mt-1">
                No ink found for:{' '}
                <span className="font-mono font-medium">{result.missing.join(' ')}</span>. Fill these in
                on the next step — you can draw any of them by hand.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
