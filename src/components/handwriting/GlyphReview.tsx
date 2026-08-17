'use client';

/**
 * The accuracy checkpoint.
 *
 * Every captured glyph is shown against a baseline at the size and offset the
 * renderer will actually use, so a letter that came out too high, too small, or
 * with a speck attached is visible at a glance — and one tap redraws it. This is
 * what turns "the extraction usually works" into "the profile is exactly right
 * before you write a word with it".
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { CHARSET, REQUIRED_CHARS } from '@/lib/handwriting/charset';
import type { GlyphMap, GlyphSample } from '@/lib/handwriting/types';
import GlyphDrawPad from './GlyphDrawPad';

/** Preview box height in px, and the em size that fills it sensibly. */
const BOX_H = 68;
const PREVIEW_EM = BOX_H / 1.7;
const PREVIEW_BASELINE = PREVIEW_EM * 1.15;

const GROUPS: { label: string; from: number; to: number }[] = [
  { label: 'Lowercase', from: 0, to: 26 },
  { label: 'Uppercase', from: 26, to: 52 },
  { label: 'Numbers', from: 52, to: 62 },
  { label: 'Punctuation', from: 62, to: CHARSET.length },
];

interface GlyphReviewProps {
  glyphs: GlyphMap;
  onReplace: (char: string, sample: GlyphSample) => void;
  onRemove: (char: string) => void;
  /** Wipe the whole draft — the escape hatch after a bad sheet import. */
  onClearAll?: () => void;
}

function GlyphCell({
  char,
  sample,
  onEdit,
  onRemove,
}: {
  char: string;
  sample: GlyphSample | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const required = REQUIRED_CHARS.indexOf(char) !== -1;

  return (
    <div
      className={`group relative rounded-xl border transition-colors ${
        sample
          ? 'border-gray-200 bg-white hover:border-violet-300'
          : required
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-dashed border-gray-200 bg-gray-50'
      }`}
    >
      <button onClick={onEdit} className="block w-full cursor-pointer" title={`Redraw "${char}"`}>
        <div className="relative overflow-hidden" style={{ height: BOX_H }}>
          {/* Baseline reference, so vertical placement is checkable by eye. */}
          <div
            className="absolute left-1 right-1 border-t border-violet-200"
            style={{ top: PREVIEW_BASELINE }}
          />
          {sample ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sample.png}
              alt={char}
              className="absolute"
              style={{
                width: sample.wEm * PREVIEW_EM,
                height: sample.hEm * PREVIEW_EM,
                left: `calc(50% - ${(sample.wEm * PREVIEW_EM) / 2}px)`,
                top: PREVIEW_BASELINE + sample.topEm * PREVIEW_EM,
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xs font-medium ${required ? 'text-amber-600' : 'text-gray-400'}`}>
                {required ? 'needed' : 'optional'}
              </span>
            </div>
          )}
        </div>
        <div className="px-2 py-1 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-gray-700">{char}</span>
          <Pencil size={11} className="text-gray-300 group-hover:text-violet-500 transition-colors" />
        </div>
      </button>

      {sample && (
        <button
          onClick={onRemove}
          title={`Remove "${char}"`}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

export default function GlyphReview({ glyphs, onReplace, onRemove, onClearAll }: GlyphReviewProps) {
  const [editing, setEditing] = useState<string | null>(null);

  const missingRequired = useMemo(
    () => REQUIRED_CHARS.filter((c) => !glyphs[c] || glyphs[c].length === 0),
    [glyphs]
  );
  const capturedCount = useMemo(
    () => CHARSET.filter((c) => glyphs[c] && glyphs[c].length > 0).length,
    [glyphs]
  );

  return (
    <div className="space-y-5">
      {missingRequired.length > 0 ? (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">
              {missingRequired.length} essential character
              {missingRequired.length === 1 ? '' : 's'} still missing
            </div>
            <div className="mt-1">
              Tap any box below to draw it:{' '}
              <span className="font-mono font-medium">{missingRequired.join(' ')}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">
              {capturedCount} of {CHARSET.length} characters captured.
            </span>{' '}
            Every letter, number, and common punctuation mark is present — check the shapes below, then
            start writing.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <p className="text-sm text-gray-500 flex-1 min-w-[240px]">
          Each preview sits on its baseline exactly as it will on the page. If a letter looks too high
          or low, or picked up a stray mark, tap it and draw it again.
        </p>
        {onClearAll && capturedCount > 0 && (
          <button
            onClick={() => {
              if (confirm(`Remove all ${capturedCount} captured characters and start over?`)) {
                onClearAll();
              }
            }}
            className="px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 border border-red-100 transition-colors"
          >
            Clear all &amp; start over
          </button>
        )}
      </div>

      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {group.label}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {CHARSET.slice(group.from, group.to).map((char) => {
              const samples = glyphs[char] ?? [];
              return (
                <GlyphCell
                  key={char}
                  char={char}
                  sample={samples.length > 0 ? samples[samples.length - 1] : null}
                  onEdit={() => setEditing(char)}
                  onRemove={() => onRemove(char)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {editing !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5">
            <div className="flex items-baseline gap-2 mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Redraw</h3>
              <span className="text-2xl font-bold text-violet-700">{editing}</span>
            </div>
            <GlyphDrawPad
              key={editing}
              char={editing}
              existing={glyphs[editing]?.[glyphs[editing].length - 1] ?? null}
              commitLabel="Replace"
              onCancel={() => setEditing(null)}
              onCommit={(sample) => {
                if (sample) onReplace(editing, sample);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
