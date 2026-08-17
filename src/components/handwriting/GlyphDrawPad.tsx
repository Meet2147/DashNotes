'use client';

/**
 * A single-character writing pad with printed-style guides.
 *
 * Two stacked canvases: guides underneath, ink on top. The ink canvas stays
 * transparent apart from the strokes, so reading its alpha channel gives a clean
 * mask with no guide lines to filter out — this path captures a glyph exactly,
 * with none of the thresholding uncertainty a photo carries.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Undo2, Check, X } from 'lucide-react';
import { sampleFromDrawing } from '@/lib/handwriting/extract';
import type { GlyphSample } from '@/lib/handwriting/types';

/** Pad geometry in mm, mirroring the printed cell but roomier. */
const PAD = {
  widthMm: 62,
  heightMm: 42,
  ascenderMm: 9,
  xHeightMm: 19,
  baselineMm: 29,
  descenderMm: 37,
  pxPerMm: 10,
};

const PAD_EM_PX = (PAD.baselineMm - PAD.ascenderMm) * PAD.pxPerMm; // 200px
const PAD_BASELINE_PX = PAD.baselineMm * PAD.pxPerMm;
const CANVAS_W = PAD.widthMm * PAD.pxPerMm;
const CANVAS_H = PAD.heightMm * PAD.pxPerMm;

interface Stroke {
  points: { x: number; y: number; w: number }[];
}

interface GlyphDrawPadProps {
  char: string;
  /** Existing sample, shown ghosted underneath as a reference. */
  existing?: GlyphSample | null;
  onCommit: (sample: GlyphSample | null) => void;
  onCancel?: () => void;
  /** Label on the commit button. */
  commitLabel?: string;
  penWidthMm?: number;
}

export default function GlyphDrawPad({
  char,
  existing,
  onCommit,
  onCancel,
  commitLabel = 'Save',
  penWidthMm = 0.55,
}: GlyphDrawPadProps) {
  const guideRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const basePenPx = penWidthMm * PAD.pxPerMm;

  // ---- Guides -------------------------------------------------------------
  useEffect(() => {
    const canvas = guideRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const line = (y: number, color: string, dashed: boolean, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dashed ? [7, 9] : []);
      ctx.beginPath();
      ctx.moveTo(8, Math.round(y) + 0.5);
      ctx.lineTo(CANVAS_W - 8, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    line(PAD.ascenderMm * PAD.pxPerMm, '#E9D5FF', true, 1.5);
    line(PAD.xHeightMm * PAD.pxPerMm, '#DDD6FE', true, 1.5);
    line(PAD_BASELINE_PX, '#8B5CF6', false, 2.5);
    line(PAD.descenderMm * PAD.pxPerMm, '#E9D5FF', true, 1.5);

    ctx.fillStyle = '#C4B5FD';
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('baseline', 10, PAD_BASELINE_PX - 8);

    // Which character this pad is for, in the corner as a reminder.
    ctx.fillStyle = '#EDE9FE';
    ctx.font = `700 ${Math.round(PAD.pxPerMm * 9)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(char, CANVAS_W - 12, CANVAS_H - 12);
    ctx.textAlign = 'left';

    // Ghost the existing sample so a redraw can match its size and position.
    if (existing?.png) {
      const img = new Image();
      img.onload = () => {
        ctx.globalAlpha = 0.16;
        ctx.drawImage(
          img,
          CANVAS_W / 2 - (existing.wEm * PAD_EM_PX) / 2,
          PAD_BASELINE_PX + existing.topEm * PAD_EM_PX,
          existing.wEm * PAD_EM_PX,
          existing.hEm * PAD_EM_PX
        );
        ctx.globalAlpha = 1;
      };
      img.src = existing.png;
    }
  }, [existing, char]);

  // ---- Ink canvas ---------------------------------------------------------
  const redrawInk = useCallback(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokesRef.current) {
      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, pts[0].w / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        continue;
      }
      // Draw segment by segment so the width can follow stylus pressure.
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.lineWidth = (a.w + b.w) / 2;
        ctx.beginPath();
        if (i === 1) {
          ctx.moveTo(a.x, a.y);
        } else {
          const prev = pts[i - 2];
          ctx.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2);
        }
        ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
        ctx.stroke();
      }
    }
  }, []);

  // Callers pass key={char}, so moving to another character remounts the pad and
  // this runs once on a clean, empty stroke list.
  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    redrawInk();
  }, [redrawInk]);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
      // Mice report 0 or 0.5; treat anything unhelpful as medium pressure.
      w: basePenPx * (e.pressure > 0 && e.pressure !== 0.5 ? 0.65 + e.pressure * 0.8 : 1),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvas(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current.push({ points: [p] });
    redrawInk();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = toCanvas(e);
    if (!p) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const last = stroke.points[stroke.points.length - 1];
    // Skip points that add nothing, so smoothing stays stable.
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
    stroke.points.push(p);
    redrawInk();
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setStrokeCount(strokesRef.current.length);
  };

  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawInk();
  };

  const clear = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    redrawInk();
  };

  const commit = () => {
    const canvas = inkRef.current;
    if (!canvas || strokesRef.current.length === 0) {
      onCommit(null);
      return;
    }
    onCommit(sampleFromDrawing(canvas, PAD_BASELINE_PX, PAD_EM_PX));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full select-none" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
        <canvas
          ref={guideRef}
          className="absolute inset-0 w-full h-full rounded-xl border border-gray-200"
        />
        <canvas
          ref={inkRef}
          className="absolute inset-0 w-full h-full rounded-xl touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={undo}
          disabled={strokeCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          <Undo2 size={14} /> Undo stroke
        </button>
        <button
          onClick={clear}
          disabled={strokeCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          <Eraser size={14} /> Clear
        </button>

        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          )}
          <button
            onClick={commit}
            disabled={strokeCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            <Check size={14} /> {commitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
