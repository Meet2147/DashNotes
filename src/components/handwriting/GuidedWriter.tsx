'use client';

/**
 * Walks the user through the character set one letter at a time on a stylus or
 * finger pad.
 *
 * This is the highest-fidelity capture route: the strokes are recorded directly,
 * so there is no photo, no perspective, and no thresholding — the stored glyph is
 * precisely what was drawn. The printed-sheet route exists for people who would
 * rather write on paper.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, SkipForward } from 'lucide-react';
import { CHARSET, REQUIRED_CHARS } from '@/lib/handwriting/charset';
import type { GlyphMap, GlyphSample } from '@/lib/handwriting/types';
import GlyphDrawPad from './GlyphDrawPad';

interface GuidedWriterProps {
  glyphs: GlyphMap;
  onSave: (char: string, sample: GlyphSample) => void;
  onFinish: () => void;
}

const GROUPS: { label: string; chars: string[] }[] = [
  { label: 'Lowercase', chars: CHARSET.slice(0, 26) },
  { label: 'Uppercase', chars: CHARSET.slice(26, 52) },
  { label: 'Numbers', chars: CHARSET.slice(52, 62) },
  { label: 'Punctuation', chars: CHARSET.slice(62) },
];

export default function GuidedWriter({ glyphs, onSave, onFinish }: GuidedWriterProps) {
  const [index, setIndex] = useState(() => {
    const firstGap = CHARSET.findIndex((c) => !glyphs[c] || glyphs[c].length === 0);
    return firstGap === -1 ? 0 : firstGap;
  });

  const char = CHARSET[index];
  const captured = useMemo(
    () => CHARSET.filter((c) => glyphs[c] && glyphs[c].length > 0).length,
    [glyphs]
  );
  const requiredLeft = useMemo(
    () => REQUIRED_CHARS.filter((c) => !glyphs[c] || glyphs[c].length === 0).length,
    [glyphs]
  );

  const advance = () => {
    // Jump forward to the next character we still need, so a second pass over a
    // half-finished set does not make the user tap through everything again.
    for (let i = index + 1; i < CHARSET.length; i++) {
      if (!glyphs[CHARSET[i]] || glyphs[CHARSET[i]].length === 0) {
        setIndex(i);
        return;
      }
    }
    setIndex(Math.min(CHARSET.length - 1, index + 1));
  };

  const handleCommit = (sample: GlyphSample | null) => {
    if (sample) onSave(char, sample);
    advance();
  };

  const existing = glyphs[char]?.[glyphs[char].length - 1] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-gray-500">Write this character:</span>
          <span className="text-3xl font-bold text-violet-700 tabular-nums">{char}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            <span className="font-semibold text-gray-900">{captured}</span> / {CHARSET.length} captured
          </span>
          {requiredLeft > 0 ? (
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
              {requiredLeft} essential left
            </span>
          ) : (
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
              Ready to write
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${(captured / CHARSET.length) * 100}%` }}
        />
      </div>

      <p className="text-sm text-gray-500">
        Sit the character on the purple baseline. Tall letters reach the top dotted line, and tails
        such as <span className="font-medium text-gray-700">g</span> or{' '}
        <span className="font-medium text-gray-700">y</span> drop to the bottom one — that is how the
        renderer knows where each letter belongs on a ruled page.
      </p>

      <GlyphDrawPad
        key={char}
        char={char}
        existing={existing}
        onCommit={handleCommit}
        commitLabel="Save & next"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          onClick={advance}
          disabled={index >= CHARSET.length - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          <SkipForward size={14} /> Skip
        </button>
        <button
          onClick={() => setIndex(Math.min(CHARSET.length - 1, index + 1))}
          disabled={index >= CHARSET.length - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          Next <ChevronRight size={14} />
        </button>
        <button
          onClick={onFinish}
          disabled={requiredLeft > 0}
          title={requiredLeft > 0 ? 'Capture the letters, numbers, and basic punctuation first' : undefined}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors"
        >
          <Check size={14} /> Review & continue
        </button>
      </div>

      {/* Jump to any character */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1">
              {group.chars.map((c) => {
                const done = Boolean(glyphs[c] && glyphs[c].length > 0);
                const active = c === char;
                return (
                  <button
                    key={c}
                    onClick={() => setIndex(CHARSET.indexOf(c))}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-violet-600 text-white'
                        : done
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={done ? `${c} — captured` : `${c} — not captured yet`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
