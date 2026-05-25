'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus,
  AlignLeft, AlignCenter, AlignRight,
  ImageIcon, Pin, Lock, Trash2, Download,
  FolderOpen,
  ChevronLeft,
} from 'lucide-react';
import { db, NOTE_COLORS } from '@/lib/db';
import { useAppStore } from '@/store/useAppStore';
import { useNote, useCollections } from '@/hooks/useNotes';
import TagInput from './TagInput';
import ExportModal from './ExportModal';

const AUTOSAVE_DELAY = 800;

// ToolbarBtn defined outside component to avoid recreation on render
function ToolbarBtn({
  onClick,
  active,
  title: t,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={t}
      className={`p-1.5 rounded-md text-sm transition-colors ${
        active
          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />;
}

function EmptyEditor() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-center px-8">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-5">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-violet-400" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">No note selected</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
        Select a note from the list or create a new one to start writing.
      </p>
    </div>
  );
}

export default function Editor() {
  const { selectedNoteId, setSelectedNoteId, setMobilePanel } = useAppStore();
  const note = useNote(selectedNoteId);
  const collections = useCollections();

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [locked, setLocked] = useState(false);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[NOTE_COLORS.length - 1]);
  const [collectionId, setCollectionId] = useState<number | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // Track which note ID we've synced to avoid unnecessary editor re-sets
  const syncedNoteIdRef = useRef<number | null>(null);

  const scheduleSave = useCallback(
    (partial: Partial<{ title: string; content: string; tags: string[]; pinned: boolean; locked: boolean; color: string; collectionId: number | undefined }>) => {
      if (!selectedNoteId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setIsSaving(true);
        await db.notes.update(selectedNoteId, { ...partial, updatedAt: new Date() });
        setIsSaving(false);
      }, AUTOSAVE_DELAY);
    },
    [selectedNoteId]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      scheduleSave({ content: ed.getHTML() });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-6 py-4',
      },
    },
  });

  // Sync note data into local state when the selected note changes
  useEffect(() => {
    if (!note || note.id === syncedNoteIdRef.current) return;
    syncedNoteIdRef.current = note.id ?? null;

    setTitle(note.title);
    setTags(note.tags);
    setPinned(note.pinned);
    setLocked(note.locked);
    setNoteColor(note.color);
    setCollectionId(note.collectionId);

    if (editor) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== note.content) {
        // setContent triggers onUpdate which updates wordCount
        editor.commands.setContent(note.content || '');
      }
    }

    // Focus title on new empty note
    if (note.title === '' && note.content === '' && titleRef.current) {
      titleRef.current.focus();
    }
  }, [note, editor]);

  // Reset synced ref when note ID changes so we always re-sync on note switch
  useEffect(() => {
    if (selectedNoteId !== syncedNoteIdRef.current) {
      syncedNoteIdRef.current = null;
    }
  }, [selectedNoteId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    scheduleSave({ tags: newTags });
  };

  const handleTogglePin = async () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    if (selectedNoteId) {
      await db.notes.update(selectedNoteId, { pinned: newPinned, updatedAt: new Date() });
    }
  };

  const handleToggleLock = async () => {
    const newLocked = !locked;
    setLocked(newLocked);
    if (selectedNoteId) {
      await db.notes.update(selectedNoteId, { locked: newLocked, updatedAt: new Date() });
    }
  };

  const handleColorChange = async (color: string) => {
    setNoteColor(color);
    setShowColorPicker(false);
    if (selectedNoteId) {
      await db.notes.update(selectedNoteId, { color, updatedAt: new Date() });
    }
  };

  const handleCollectionChange = async (id: number | undefined) => {
    setCollectionId(id);
    setShowCollectionPicker(false);
    if (selectedNoteId) {
      await db.notes.update(selectedNoteId, { collectionId: id, updatedAt: new Date() });
    }
  };

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await db.notes.delete(selectedNoteId);
    setSelectedNoteId(null);
  };

  const handleImageInsert = () => {
    const url = prompt('Enter image URL:');
    if (url) editor?.commands.setImage({ src: url });
  };

  if (!selectedNoteId || !note) {
    return <EmptyEditor />;
  }

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-gray-800"
      style={{
        backgroundColor:
          noteColor !== '#ffffff' && noteColor !== '#FFFFFF' ? noteColor + '22' : undefined,
      }}
    >
      {/* Mobile back button */}
      <div className="md:hidden flex items-center px-3 pt-3">
        <button
          onClick={() => setMobilePanel('notes')}
          className="flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 font-medium"
        >
          <ChevronLeft size={16} /> Notes
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10">
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline">
          <UnderlineIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
          <Strikethrough size={14} />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={14} />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List">
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered List">
          <ListOrdered size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Quote">
          <Quote size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus size={14} />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight size={14} />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn onClick={handleImageInsert} title="Insert Image">
          <ImageIcon size={14} />
        </ToolbarBtn>

        {/* Saving indicator */}
        <div className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {isSaving ? 'Saving...' : ''}
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pt-5 pb-2">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder="Note title"
          className="w-full text-2xl font-bold text-gray-900 dark:text-gray-100 bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-600"
        />
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Bottom meta bar */}
      <div className="border-t border-gray-100 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2.5">
        {/* Tags row */}
        <div className="mb-2.5">
          <TagInput tags={tags} onChange={handleTagsChange} placeholder="Add tags..." />
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Word count */}
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>

          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => { setShowColorPicker(!showColorPicker); setShowCollectionPicker(false); }}
              className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-700 shadow-sm transition-transform hover:scale-110"
              style={{ backgroundColor: noteColor }}
              title="Note color"
            />
            {showColorPicker && (
              <div className="absolute bottom-full left-0 mb-2 flex gap-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-20">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: noteColor === c ? '#7C3AED' : '#e5e7eb',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Collection picker */}
          <div className="relative">
            <button
              onClick={() => { setShowCollectionPicker(!showCollectionPicker); setShowColorPicker(false); }}
              title="Collection"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <FolderOpen size={13} />
              {collectionId ? collections.find((c) => c.id === collectionId)?.name ?? 'Collection' : 'Collection'}
            </button>
            {showCollectionPicker && (
              <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[160px]">
                <button
                  onClick={() => handleCollectionChange(undefined)}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  None
                </button>
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => handleCollectionChange(col.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleTogglePin}
              title={pinned ? 'Unpin' : 'Pin'}
              className={`p-1.5 rounded-lg transition-colors ${pinned ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Pin size={14} className={pinned ? 'rotate-45' : ''} />
            </button>
            <button
              onClick={handleToggleLock}
              title={locked ? 'Unlock' : 'Lock'}
              className={`p-1.5 rounded-lg transition-colors ${locked ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Lock size={14} />
            </button>
            <button
              onClick={() => setExportOpen(true)}
              title="Export"
              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Download size={14} />
            </button>
            <button
              onClick={handleDelete}
              title="Delete note"
              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {exportOpen && note && (
        <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} note={{ ...note, title, tags }} />
      )}
    </div>
  );
}
