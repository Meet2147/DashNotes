'use client';

/**
 * Type (or paste) text, see it appear on ruled paper in the user's own hand,
 * export it as PNG pages or a print-ready PDF.
 *
 * The preview and the export share one layout pass — line breaks and pagination
 * are computed in millimetres, so a 120dpi preview and a 300dpi export break in
 * exactly the same places. What you approve is what you get.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Dice5,
  Download,
  FileDown,
  Loader2,
  NotebookPen,
  Settings2,
} from 'lucide-react';
import { blocksToText } from '@/lib/handwriting/blocks';
import { makeRenderContext } from '@/lib/handwriting/context';
import { layoutText } from '@/lib/handwriting/layout';
import { buildPdf, canvasToBlob, canvasToJpegBytes, downloadBlob, safeFilename, type PdfPageImage } from '@/lib/handwriting/pdf';
import { GlyphPainter, loadGlyphImages, renderPage, renderPageInto, type GlyphImages } from '@/lib/handwriting/render';
import {
  PAGE_SIZES,
  type GlyphMap,
  type HandwritingMetrics,
  type PageSizeName,
  type PaperStyle,
  type RenderSettings,
} from '@/lib/handwriting/types';

/** Preview resolution — sharp on screen without making every keystroke expensive. */
const PREVIEW_DPI = 120;
/** Guard against a paste of a whole textbook trying to render 4,000 pages. */
const MAX_PAGES = 80;
const TEXT_DEBOUNCE_MS = 220;

const INK_PRESETS = [
  { label: 'Blue-black', value: '#1B2A6B' },
  { label: 'Black', value: '#171717' },
  { label: 'Royal blue', value: '#1D4ED8' },
  { label: 'Dark green', value: '#14532D' },
  { label: 'Violet gel', value: '#4C1D95' },
];

const PAPER_OPTIONS: { value: PaperStyle; label: string }[] = [
  { value: 'ruled-margin', label: 'Ruled + margin' },
  { value: 'ruled', label: 'Ruled' },
  { value: 'college', label: 'Exercise book' },
  { value: 'grid', label: 'Squared 5mm' },
  { value: 'blank', label: 'Blank' },
];

interface NoteSummary {
  id: string;
  title: string;
}

interface HandwritingComposerProps {
  profileName: string;
  glyphs: GlyphMap;
  metrics: Partial<HandwritingMetrics>;
  settings: Partial<RenderSettings>;
  initialText?: string;
  onSaveDefaults?: (settings: Partial<RenderSettings>) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-semibold text-gray-500 mb-1">
        {label}
        <span className="font-mono font-normal text-gray-400">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
      />
    </label>
  );
}

const selectClass =
  'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500';

export default function HandwritingComposer({
  profileName,
  glyphs,
  metrics,
  settings: initialSettings,
  initialText = '',
  onSaveDefaults,
}: HandwritingComposerProps) {
  const [text, setText] = useState(initialText);
  const [deferredText, setDeferredText] = useState(initialText);
  const [settings, setSettings] = useState<Partial<RenderSettings>>(initialSettings);
  const [pageIndex, setPageIndex] = useState(0);
  const [loadedGlyphs, setLoadedGlyphs] = useState<{ key: GlyphMap; images: GlyphImages } | null>(
    null
  );
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportDpi, setExportDpi] = useState(300);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [showSettings, setShowSettings] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const patch = useCallback((delta: Partial<RenderSettings>) => {
    setSettings((prev) => ({ ...prev, ...delta }));
  }, []);

  // ---- Glyph images -------------------------------------------------------
  // The decoded set is tagged with the glyph map it came from, so switching
  // profiles invalidates it during render rather than via a second state update.
  const images = loadedGlyphs && loadedGlyphs.key === glyphs ? loadedGlyphs.images : null;

  useEffect(() => {
    let cancelled = false;
    loadGlyphImages(glyphs)
      .then((loaded) => {
        if (!cancelled) setLoadedGlyphs({ key: glyphs, images: loaded });
      })
      .catch(() => {
        if (!cancelled) setStatus('Some stored glyphs could not be decoded.');
      });
    return () => {
      cancelled = true;
    };
  }, [glyphs]);

  const painter = useMemo(() => (images ? new GlyphPainter(images) : null), [images]);

  // ---- Debounce typing ----------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setDeferredText(text), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  // ---- Layout -------------------------------------------------------------
  const previewContext = useMemo(
    () => makeRenderContext(glyphs, metrics, { ...settings, dpi: PREVIEW_DPI }),
    [glyphs, metrics, settings]
  );

  const layout = useMemo(() => layoutText(deferredText, previewContext), [deferredText, previewContext]);

  const pages = layout.pages.slice(0, MAX_PAGES);
  const truncated = layout.pages.length > MAX_PAGES;
  // An empty document still lays out one blank page, which is a useful preview of
  // the paper settings — but there is nothing worth exporting.
  const hasContent = deferredText.trim().length > 0;

  // Editing the text can shrink the document under the current page; clamp on the
  // way out rather than correcting state after the fact.
  const currentPage = Math.min(pageIndex, Math.max(0, pages.length - 1));

  // ---- Draw the visible page ---------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const page = pages[currentPage];
    if (!canvas || !painter || !page) return;
    renderPageInto(canvas, page, previewContext, painter);
  }, [pages, currentPage, painter, previewContext]);

  // ---- Notes ------------------------------------------------------------
  useEffect(() => {
    fetch('/api/notes')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; title: string }[]) => {
        if (Array.isArray(data)) setNotes(data.map((n) => ({ id: n.id, title: n.title || 'Untitled' })));
      })
      .catch(() => setNotes([]));
  }, []);

  const loadNote = async (id: string) => {
    if (!id) return;
    setStatus('Loading note…');
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error('That note could not be loaded.');
      const note = await res.json();
      const body = blocksToText(note.content);
      const title = typeof note.title === 'string' && note.title.trim() ? `${note.title.trim()}\n\n` : '';
      setText(`${title}${body}`);
      setPageIndex(0);
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'That note could not be loaded.');
    }
  };

  // ---- Export -----------------------------------------------------------

  /**
   * Re-render at export resolution. Pages are encoded and released one at a
   * time — an A4 page at 300dpi is ~35MB of canvas, so holding twenty of them
   * would be a good way to crash a phone browser.
   */
  const renderForExport = useCallback(
    async (onPage: (canvas: HTMLCanvasElement, index: number) => Promise<void>) => {
      if (!painter) throw new Error('Handwriting is still loading.');
      const exportContext = makeRenderContext(glyphs, metrics, { ...settings, dpi: exportDpi });
      const exportLayout = layoutText(deferredText, exportContext);
      const exportPages = exportLayout.pages.slice(0, MAX_PAGES);

      for (let i = 0; i < exportPages.length; i++) {
        const canvas = renderPage(exportPages[i], exportContext, painter);
        await onPage(canvas, i);
        // Drop the backing store so the next page starts from a clean budget.
        canvas.width = 0;
        canvas.height = 0;
      }
      return exportPages.length;
    },
    [painter, glyphs, metrics, settings, exportDpi, deferredText]
  );

  const stem = safeFilename(profileName ? `${profileName}-handwritten` : 'handwritten');

  const exportPdf = async () => {
    setExporting('pdf');
    setStatus(null);
    try {
      const page = PAGE_SIZES[(settings.pageSize as PageSizeName) ?? 'a4'] ?? PAGE_SIZES.a4;
      const jpegs: PdfPageImage[] = [];
      const count = await renderForExport(async (canvas) => {
        jpegs.push(await canvasToJpegBytes(canvas, 0.93));
      });
      if (count === 0) throw new Error('There is nothing to export yet.');
      downloadBlob(buildPdf(jpegs, page.widthMm, page.heightMm), `${stem}.pdf`);
      setStatus(`Exported ${count} page${count === 1 ? '' : 's'} as PDF.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const exportPngs = async () => {
    setExporting('png');
    setStatus(null);
    try {
      const count = await renderForExport(async (canvas, i) => {
        const blob = await canvasToBlob(canvas, 'image/png');
        downloadBlob(blob, `${stem}-page-${String(i + 1).padStart(2, '0')}.png`);
        // Browsers throttle rapid successive downloads; give each one room.
        await new Promise((r) => setTimeout(r, 350));
      });
      setStatus(`Exported ${count} PNG page${count === 1 ? '' : 's'}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const copyPage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas, 'image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus('Your browser would not allow copying an image to the clipboard.');
    }
  };

  const canCopy = typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined';
  const lineSpacing = settings.lineSpacingMm ?? previewContext.settings.lineSpacingMm;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
      {/* ---- Text + preview ------------------------------------------------ */}
      <div className="space-y-4 min-w-0">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500">Your text</span>
            <span className="text-[11px] text-gray-400">
              {text.length.toLocaleString()} characters · {hasContent ? pages.length : 0} page
              {hasContent && pages.length === 1 ? '' : 's'}
            </span>
            {notes.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  loadNote(e.target.value);
                  e.target.value = '';
                }}
                className="ml-auto px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Load from a note…</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Type or paste your assignment here. Blank lines start a new paragraph."
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm leading-relaxed font-mono resize-y focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {layout.missing.length > 0 && (
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 text-sm">
            No captured glyph for{' '}
            <span className="font-mono font-semibold">{layout.missing.join(' ')}</span> — these were
            skipped. Add them from the Review step.
          </div>
        )}
        {truncated && (
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 text-sm">
            Only the first {MAX_PAGES} pages are shown and exported. Split longer documents up.
          </div>
        )}

        {/* Page preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageIndex(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm text-gray-500 tabular-nums">
              Page {hasContent ? currentPage + 1 : 0} of {hasContent ? pages.length : 0}
            </span>
            <button
              onClick={() => setPageIndex(Math.min(pages.length - 1, currentPage + 1))}
              disabled={currentPage >= pages.length - 1}
              className="p-2 rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={15} />
            </button>

            <div className="ml-auto flex items-center gap-2">
              {canCopy && (
                <button
                  onClick={copyPage}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Copy size={13} /> {copied ? 'Copied' : 'Copy page'}
                </button>
              )}
              <button
                onClick={() => patch({ seed: Math.floor(Math.random() * 1e9) })}
                title="Re-roll the natural variation"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Dice5 size={13} /> Vary
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3 sm:p-5 overflow-x-auto">
            {!painter ? (
              <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Loading your handwriting…
              </div>
            ) : !hasContent || pages[currentPage] === undefined ? (
              <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
                <NotebookPen size={28} className="text-gray-300" />
                <p className="text-sm text-gray-400">Type something above to see your page.</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="block mx-auto max-w-full h-auto shadow-lg rounded-sm bg-white"
              />
            )}
          </div>
        </div>

        {/* Export */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportPdf}
            disabled={exporting !== null || !hasContent || !painter}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {exporting === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            Download PDF
          </button>
          <button
            onClick={exportPngs}
            disabled={exporting !== null || !hasContent || !painter}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {exporting === 'png' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            PNG pages
          </button>
          <select
            value={exportDpi}
            onChange={(e) => setExportDpi(Number(e.target.value))}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value={150}>150 dpi — screen</option>
            <option value={200}>200 dpi — good print</option>
            <option value={300}>300 dpi — best print</option>
          </select>
          {status && <span className="text-xs text-gray-500">{status}</span>}
        </div>
      </div>

      {/* ---- Settings ------------------------------------------------------ */}
      <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="lg:hidden w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100"
        >
          <Settings2 size={15} /> {showSettings ? 'Hide' : 'Show'} paper & pen settings
        </button>

        <div className={`${showSettings ? 'block' : 'hidden'} lg:block space-y-4`}>
          <div className="rounded-2xl border border-gray-200 p-4 space-y-3.5">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Paper</div>

            <Field label="Style">
              <select
                value={settings.paper ?? 'ruled-margin'}
                onChange={(e) => patch({ paper: e.target.value as PaperStyle })}
                className={selectClass}
              >
                {PAPER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Page size">
              <select
                value={settings.pageSize ?? 'a4'}
                onChange={(e) => patch({ pageSize: e.target.value as PageSizeName })}
                className={selectClass}
              >
                {Object.values(PAGE_SIZES).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>

            <Slider
              label="Line spacing"
              value={lineSpacing}
              min={6}
              max={13}
              step={0.5}
              format={(v) => `${v} mm`}
              onChange={(v) => patch({ lineSpacingMm: v })}
            />
            <Slider
              label="Left margin"
              value={settings.margins?.left ?? previewContext.settings.margins.left}
              min={10}
              max={45}
              step={1}
              format={(v) => `${v} mm`}
              onChange={(v) =>
                patch({ margins: { ...previewContext.settings.margins, left: v } })
              }
            />
            <Slider
              label="Top margin"
              value={settings.margins?.top ?? previewContext.settings.margins.top}
              min={10}
              max={50}
              step={1}
              format={(v) => `${v} mm`}
              onChange={(v) => patch({ margins: { ...previewContext.settings.margins, top: v } })}
            />
            <Slider
              label="Blank lines at top"
              value={settings.firstLineOffset ?? 0}
              min={0}
              max={6}
              step={1}
              format={(v) => String(v)}
              onChange={(v) => patch({ firstLineOffset: v })}
            />
            <Slider
              label="Paper texture"
              value={settings.paperTexture ?? previewContext.settings.paperTexture}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch({ paperTexture: v })}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 space-y-3.5">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Pen</div>

            <Field label="Ink colour">
              <div className="flex flex-wrap items-center gap-2">
                {INK_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => patch({ inkColor: preset.value })}
                    title={preset.label}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: preset.value,
                      borderColor:
                        (settings.inkColor ?? previewContext.settings.inkColor) === preset.value
                          ? '#7C3AED'
                          : 'transparent',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={settings.inkColor ?? previewContext.settings.inkColor}
                  onChange={(e) => patch({ inkColor: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border border-gray-200 bg-white"
                  title="Custom colour"
                />
              </div>
            </Field>

            <Slider
              label="Nib thickness"
              value={settings.penWidth ?? previewContext.settings.penWidth}
              min={0.6}
              max={2}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => patch({ penWidth: v })}
            />
            <Slider
              label="Writing size"
              value={settings.sizeScale ?? previewContext.settings.sizeScale}
              min={0.7}
              max={1.25}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch({ sizeScale: v })}
            />
            <Slider
              label="Slant"
              value={settings.slantDeg ?? previewContext.settings.slantDeg}
              min={-10}
              max={16}
              step={0.5}
              format={(v) => `${v}°`}
              onChange={(v) => patch({ slantDeg: v })}
            />
            <Slider
              label="Neatness"
              value={settings.neatness ?? previewContext.settings.neatness}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch({ neatness: v })}
            />
            <Slider
              label="Word spacing"
              value={settings.wordSpacing ?? previewContext.settings.wordSpacing}
              min={0.5}
              max={2}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => patch({ wordSpacing: v })}
            />
            <Slider
              label="Letter spacing"
              value={settings.letterSpacing ?? previewContext.settings.letterSpacing}
              min={-0.05}
              max={0.15}
              step={0.005}
              format={(v) => `${v.toFixed(3)} em`}
              onChange={(v) => patch({ letterSpacing: v })}
            />
            <Slider
              label="Paragraph indent"
              value={settings.paragraphIndent ?? previewContext.settings.paragraphIndent}
              min={0}
              max={4}
              step={0.25}
              format={(v) => `${v} em`}
              onChange={(v) => patch({ paragraphIndent: v })}
            />
          </div>

          {onSaveDefaults && (
            <button
              onClick={() => onSaveDefaults(settings)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
            >
              Save these as my defaults
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
