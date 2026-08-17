'use client';

/**
 * Top-level orchestrator for the handwriting service.
 *
 * Four steps, in order: pick or create a profile, capture your letterforms,
 * review them, then write. The draft glyph set lives here so a user can capture
 * from the printed sheet and then patch individual characters by hand before
 * anything is saved.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  PenLine,
  Plus,
  ScanLine,
  Star,
  Trash2,
} from 'lucide-react';
import { blocksToText } from '@/lib/handwriting/blocks';
import { CHARSET } from '@/lib/handwriting/charset';
import { missingRequired } from '@/lib/handwriting/validate';
import type {
  GlyphMap,
  GlyphSample,
  HandwritingProfile,
  HandwritingProfileSummary,
  RenderSettings,
} from '@/lib/handwriting/types';
import GlyphReview from './GlyphReview';
import GuidedWriter from './GuidedWriter';
import HandwritingComposer from './HandwritingComposer';
import TemplateStep from './TemplateStep';

type Step = 'profiles' | 'capture' | 'review' | 'compose';
type CaptureMode = 'screen' | 'sheet';

/** Keep at most this many samples per character, so variation stays cheap. */
const MAX_SAMPLES = 3;

interface HandwritingStudioProps {
  /** Optional note whose text should be pre-loaded into the composer. */
  noteId?: string;
}

function StepBadge({
  index,
  label,
  active,
  done,
  onClick,
  disabled,
}: {
  index: number;
  label: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'bg-violet-600 text-white'
          : done
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
          active ? 'bg-white/20' : done ? 'bg-emerald-100' : 'bg-white'
        }`}
      >
        {done && !active ? <Check size={11} /> : index}
      </span>
      {label}
    </button>
  );
}

export default function HandwritingStudio({ noteId }: HandwritingStudioProps) {
  const [step, setStep] = useState<Step>('profiles');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('screen');
  const [profiles, setProfiles] = useState<HandwritingProfileSummary[]>([]);
  const [active, setActive] = useState<HandwritingProfile | null>(null);
  const [draft, setDraft] = useState<GlyphMap>({});
  const [draftName, setDraftName] = useState('My Handwriting');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  /**
   * The composer seeds its textarea from initialText at mount, so when we arrive
   * from a note's "Handwrite" button we hold the composer back until that fetch
   * has settled — otherwise the text would land after mount and be ignored.
   */
  const [notePending, setNotePending] = useState(Boolean(noteId));

  // ---- Profile loading ----------------------------------------------------

  const loadProfiles = useCallback(async () => {
    const res = await fetch('/api/handwriting/profiles');
    if (!res.ok) throw new Error('Your handwriting profiles could not be loaded.');
    return (await res.json()) as HandwritingProfileSummary[];
  }, []);

  const openProfile = useCallback(async (id: string, target: Step = 'compose') => {
    setError(null);
    const res = await fetch(`/api/handwriting/profiles/${id}`);
    if (!res.ok) {
      setError('That handwriting profile could not be opened.');
      return;
    }
    const profile = (await res.json()) as HandwritingProfile;
    setActive(profile);
    setDraft(profile.glyphs ?? {});
    setDraftName(profile.name);
    setEditingId(profile.id);
    setStep(target);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadProfiles();
        if (cancelled) return;
        setProfiles(list);
        // Drop straight into the composer when there is already a default.
        const preferred = list.find((p) => p.isDefault) ?? list[0];
        if (preferred) await openProfile(preferred.id, 'compose');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfiles, openProfile]);

  // ---- Pre-load a note's text ---------------------------------------------
  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    fetch(`/api/notes/${noteId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((note) => {
        if (cancelled || !note) return;
        const title = typeof note.title === 'string' && note.title.trim() ? `${note.title.trim()}\n\n` : '';
        setNoteText(`${title}${blocksToText(note.content)}`);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setNotePending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // ---- Draft editing ------------------------------------------------------

  const addSamples = useCallback((incoming: GlyphMap) => {
    setDraft((prev) => {
      const next: GlyphMap = { ...prev };
      for (const [char, samples] of Object.entries(incoming)) {
        next[char] = [...(next[char] ?? []), ...samples].slice(-MAX_SAMPLES);
      }
      return next;
    });
  }, []);

  const replaceSample = useCallback((char: string, sample: GlyphSample) => {
    setDraft((prev) => ({ ...prev, [char]: [sample] }));
  }, []);

  const removeChar = useCallback((char: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[char];
      return next;
    });
  }, []);

  const stillNeeded = useMemo(() => missingRequired(draft), [draft]);
  const capturedCount = useMemo(
    () => CHARSET.filter((c) => draft[c] && draft[c].length > 0).length,
    [draft]
  );

  // ---- Saving -------------------------------------------------------------

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { name: draftName, glyphs: draft };
      const res = await fetch(
        editingId ? `/api/handwriting/profiles/${editingId}` : '/api/handwriting/profiles',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'The profile could not be saved.');

      const id: string = data.id ?? editingId;
      setProfiles(await loadProfiles());
      await openProfile(id, 'compose');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveDefaults = async (settings: Partial<RenderSettings>) => {
    if (!editingId) return;
    setError(null);
    const res = await fetch(`/api/handwriting/profiles/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) setError('Those defaults could not be saved.');
    else setActive((prev) => (prev ? { ...prev, settings: settings as RenderSettings } : prev));
  };

  const deleteProfile = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? The captured handwriting will be gone for good.`)) return;
    setError(null);
    const res = await fetch(`/api/handwriting/profiles/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('That profile could not be deleted.');
      return;
    }
    const list = await loadProfiles();
    setProfiles(list);
    if (editingId === id) {
      setActive(null);
      setEditingId(null);
      setDraft({});
      setStep('profiles');
    }
  };

  const makeDefault = async (id: string) => {
    await fetch(`/api/handwriting/profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    setProfiles(await loadProfiles());
  };

  const startNew = () => {
    setActive(null);
    setEditingId(null);
    setDraft({});
    setDraftName(`My Handwriting ${profiles.length > 0 ? profiles.length + 1 : ''}`.trim());
    setCaptureMode('screen');
    setStep('capture');
  };

  // ---- Render -------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-sm text-gray-400">
        <Loader2 size={18} className="animate-spin" /> Loading your handwriting…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-violet-600 transition-colors"
        >
          <ArrowLeft size={15} /> Notes
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Handwriting</h1>
        {active && step === 'compose' && (
          <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold">
            {active.name}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="flex flex-wrap items-center gap-2">
        <StepBadge
          index={1}
          label="Profiles"
          active={step === 'profiles'}
          done={profiles.length > 0}
          disabled={false}
          onClick={() => setStep('profiles')}
        />
        <ChevronRight size={14} className="text-gray-300" />
        <StepBadge
          index={2}
          label="Capture"
          active={step === 'capture'}
          done={capturedCount > 0}
          disabled={false}
          onClick={() => setStep('capture')}
        />
        <ChevronRight size={14} className="text-gray-300" />
        <StepBadge
          index={3}
          label="Review"
          active={step === 'review'}
          done={capturedCount > 0 && stillNeeded.length === 0}
          disabled={capturedCount === 0}
          onClick={() => setStep('review')}
        />
        <ChevronRight size={14} className="text-gray-300" />
        <StepBadge
          index={4}
          label="Write"
          active={step === 'compose'}
          done={false}
          disabled={!active}
          onClick={() => active && setStep('compose')}
        />
      </div>

      {error && (
        <div className="px-3.5 py-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* ---- Step: profiles ------------------------------------------------ */}
      {step === 'profiles' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-1">Write assignments in your own hand</h2>
            <p className="text-sm text-gray-500 max-w-2xl">
              Capture your handwriting once, then type anything and get it back as pages of ruled
              paper in your own letterforms. Because the pages are drawn from your actual ink rather
              than a look-alike font, the result is your handwriting — and the text is reproduced
              exactly as you typed it.
            </p>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <PenLine size={26} className="text-violet-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">No handwriting captured yet</h3>
              <p className="text-sm text-gray-500 mb-5">
                It takes about five minutes. You can write on screen with a stylus or finger, or print
                a sheet and photograph it.
              </p>
              <button
                onClick={startNew}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
              >
                <Plus size={16} /> Capture my handwriting
              </button>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      editingId === p.id ? 'border-violet-300 bg-violet-50/40' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 truncate">{p.name}</span>
                          {p.isDefault && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wide">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {p.glyphCount} of {CHARSET.length} characters
                        </div>
                      </div>
                      {!p.isDefault && (
                        <button
                          onClick={() => makeDefault(p.id)}
                          title="Make default"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-violet-600 transition-colors"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteProfile(p.id, p.name)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openProfile(p.id, 'compose')}
                        className="flex-1 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
                      >
                        Write
                      </button>
                      <button
                        onClick={() => openProfile(p.id, 'review')}
                        className="px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        Edit letters
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={startNew}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
              >
                <Plus size={15} /> Capture another handwriting
              </button>
            </>
          )}
        </div>
      )}

      {/* ---- Step: capture ------------------------------------------------- */}
      {step === 'capture' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCaptureMode('screen')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                captureMode === 'screen'
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <PenLine size={15} /> Write on screen
            </button>
            <button
              onClick={() => setCaptureMode('sheet')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                captureMode === 'sheet'
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ScanLine size={15} /> Print & photograph a sheet
            </button>
          </div>

          <p className="text-sm text-gray-500">
            {captureMode === 'screen'
              ? 'Best with a stylus or on a tablet — strokes are recorded directly, so each glyph is captured exactly as drawn.'
              : 'Best if you would rather write on paper. A photo is flattened using the four corner squares, then each box is read.'}
          </p>

          <div className="rounded-2xl border border-gray-200 p-5">
            {captureMode === 'screen' ? (
              <GuidedWriter
                glyphs={draft}
                onSave={(char, sample) => replaceSample(char, sample)}
                onFinish={() => setStep('review')}
              />
            ) : (
              <TemplateStep
                onExtracted={(glyphs) => {
                  addSamples(glyphs);
                  setStep('review');
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ---- Step: review ------------------------------------------------- */}
      {step === 'review' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 p-5">
            <label className="block max-w-sm">
              <span className="block text-xs font-semibold text-gray-500 mb-1.5">Profile name</span>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 p-5">
            <GlyphReview glyphs={draft} onReplace={replaceSample} onRemove={removeChar} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={saveDraft}
              disabled={saving || stillNeeded.length > 0}
              title={
                stillNeeded.length > 0
                  ? `Still missing: ${stillNeeded.join(' ')}`
                  : undefined
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {editingId ? 'Save changes & write' : 'Save & start writing'}
            </button>
            <button
              onClick={() => setStep('capture')}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Capture more characters
            </button>
            {stillNeeded.length > 0 && (
              <span className="text-xs text-amber-700">
                Still needed: <span className="font-mono">{stillNeeded.join(' ')}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---- Step: compose ------------------------------------------------ */}
      {step === 'compose' && active && notePending && (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Loading your note…
        </div>
      )}

      {step === 'compose' && active && !notePending && (
        <HandwritingComposer
          key={active.id}
          profileName={active.name}
          glyphs={active.glyphs}
          metrics={active.metrics ?? {}}
          settings={active.settings ?? {}}
          initialText={noteText}
          onSaveDefaults={saveDefaults}
        />
      )}
    </div>
  );
}
