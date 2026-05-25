'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useAppStore } from '@/store/useAppStore';
import { Note } from '@/types';
import { Pin, Trash2, ChevronLeft, Loader2, BookOpen } from 'lucide-react';

const AUTOSAVE_DELAY = 800;

function EmptyEditor() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center px-8">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-5">
        <BookOpen size={36} className="text-violet-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-500 mb-2">No note selected</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Select a note from the list or create a new one to start writing.
      </p>
    </div>
  );
}

interface BlockEditorProps {
  note: Note | null;
}

export default function BlockEditor({ note }: BlockEditorProps) {
  const { setSelectedNoteId, setMobilePanel, toggleAiSidebar } = useAppStore();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteId = useRef<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const isLoading = useRef(false);

  const editor = useCreateBlockNote({});

  // Sync note into editor when note changes
  useEffect(() => {
    if (!note) {
      currentNoteId.current = null;
      setTitle('');
      setIsPinned(false);
      return;
    }

    if (note.id === currentNoteId.current) return;
    currentNoteId.current = note.id;
    isLoading.current = true;

    setTitle(note.title ?? '');
    setIsPinned(note.pinned ?? false);

    // Load content into editor
    const loadContent = async () => {
      try {
        const content = note.content;
        if (Array.isArray(content) && content.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await editor.replaceBlocks(editor.document, content as any);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await editor.replaceBlocks(editor.document, [{ type: 'paragraph', content: '' }] as any);
        }
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await editor.replaceBlocks(editor.document, [{ type: 'paragraph', content: '' }] as any);
      } finally {
        // Brief delay to avoid saving the just-loaded content
        setTimeout(() => { isLoading.current = false; }, 100);
      }
    };
    loadContent();
  }, [note, editor]);

  const scheduleSave = useCallback(
    (partial: { title?: string; content?: unknown[]; pinned?: boolean }) => {
      if (!currentNoteId.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const noteId = currentNoteId.current;
      saveTimer.current = setTimeout(async () => {
        setIsSaving(true);
        await fetch(`/api/notes/${noteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        });
        setIsSaving(false);
      }, AUTOSAVE_DELAY);
    },
    []
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor.focus();
    }
  };

  const handleTogglePin = () => {
    if (!note) return;
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    scheduleSave({ pinned: newPinned });
  };

  const handleDelete = async () => {
    if (!note) return;
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    setSelectedNoteId(null);
  };

  if (!note) {
    return <EmptyEditor />;
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
      {/* Mobile back button */}
      <div className="md:hidden flex items-center px-3 pt-3">
        <button
          onClick={() => setMobilePanel('notes')}
          className="flex items-center gap-1 text-sm text-violet-600 font-medium"
        >
          <ChevronLeft size={16} /> Notes
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="ml-auto flex items-center gap-2">
          {isSaving && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              Saving...
            </div>
          )}
          <button
            onClick={handleTogglePin}
            title={isPinned ? 'Unpin' : 'Pin'}
            className={`p-1.5 rounded-lg transition-colors ${
              isPinned
                ? 'text-violet-600 bg-violet-50'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Pin size={14} className={isPinned ? 'rotate-45' : ''} />
          </button>
          <button
            onClick={toggleAiSidebar}
            title="Toggle AI Sidebar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            <span>✦</span>
            Ask Feynman
          </button>
          <button
            onClick={handleDelete}
            title="Delete note"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="px-8 pt-6 pb-2">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder="Untitled"
          className="w-full text-3xl font-bold text-gray-900 bg-transparent outline-none placeholder-gray-300"
        />
      </div>

      {/* BlockNote Editor */}
      <div className="flex-1 overflow-y-auto">
        <BlockNoteView
          editor={editor}
          theme="light"
          onChange={() => {
            if (!isLoading.current) {
              scheduleSave({ content: editor.document as unknown[] });
            }
          }}
        />
      </div>
    </div>
  );
}
