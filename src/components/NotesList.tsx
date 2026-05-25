'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pin,
  ArrowUpDown,
  StickyNote,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore, SortBy } from '@/store/useAppStore';
import { Note, Collection } from '@/types';

function stripBlocks(content: unknown[]): string {
  if (!Array.isArray(content)) return '';
  const extractText = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (Array.isArray(item)) return item.map(extractText).join(' ');
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      if (obj.text) return String(obj.text);
      if (obj.content) return extractText(obj.content);
      if (obj.children) return extractText(obj.children);
    }
    return '';
  };
  return content.map(extractText).join(' ').trim();
}

const NOTE_COLORS = [
  '#FFF3CD', '#D1FAE5', '#DBEAFE', '#FCE7F3',
  '#F3E8FF', '#FEE2E2', '#FFFFFF',
];

export default function NotesList() {
  const {
    selectedNoteId,
    setSelectedNoteId,
    view,
    sortBy,
    setSortBy,
    setMobilePanel,
    searchQuery,
    selectedCollectionId,
  } = useAppStore();

  const [notes, setNotes] = useState<Note[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showSort, setShowSort] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    const res = await fetch('/api/notes');
    if (!res.ok) { setLoading(false); return; }
    let results: Note[] = await res.json();

    if (view === 'collection' && selectedCollectionId) {
      results = results.filter((n) => n.collectionId === selectedCollectionId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          stripBlocks(n.content).toLowerCase().includes(q) ||
          (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'createdAt') {
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    // Pinned always on top
    results.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    setNotes(results);
    setLoading(false);
  }, [view, selectedCollectionId, sortBy, searchQuery]);

  const loadCollections = useCallback(async () => {
    const res = await fetch('/api/collections');
    if (res.ok) {
      const data: Collection[] = await res.json();
      setCollections(data);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const createNote = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Untitled',
        content: [],
        tags: [],
        color: NOTE_COLORS[NOTE_COLORS.length - 1],
        pinned: false,
        collectionId: view === 'collection' ? selectedCollectionId : null,
      }),
    });
    if (res.ok) {
      const data: Note = await res.json();
      await loadNotes();
      setSelectedNoteId(data.id);
      setMobilePanel('editor');
    }
  };

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);
    setMobilePanel('editor');
  };

  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'updatedAt', label: 'Last Modified' },
    { value: 'createdAt', label: 'Date Created' },
    { value: 'title', label: 'Title (A-Z)' },
  ];

  const viewTitle = () => {
    switch (view) {
      case 'all': return searchQuery ? `"${searchQuery}"` : 'All Notes';
      case 'collection': return 'Collection';
      case 'tags': return 'Tags';
      default: return 'Notes';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 text-base truncate">
            {viewTitle()}
          </h2>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Sort"
              >
                <ArrowUpDown size={15} />
              </button>
              {showSort && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 min-w-[160px]">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setShowSort(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        sortBy === opt.value
                          ? 'text-violet-700 bg-violet-50 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={createNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {loading ? 'Loading...' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
        </p>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onClick={() => showSort && setShowSort(false)}
      >
        {!loading && notes.length === 0 ? (
          <EmptyState onCreateNote={createNote} view={view} />
        ) : (
          <div className="p-2 space-y-1">
            {notes.map((note) => {
              const collection = note.collectionId ? collectionMap.get(note.collectionId) : null;
              const preview = stripBlocks(note.content).slice(0, 100);
              const noteDate = new Date(note.updatedAt || note.createdAt);
              const isSelected = selectedNoteId === note.id;
              const cardBg = note.color && note.color !== '#FFFFFF' ? note.color : undefined;

              return (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note.id)}
                  className={`
                    w-full text-left p-3 rounded-xl transition-all border-2
                    ${isSelected
                      ? 'border-violet-400 shadow-sm'
                      : 'border-transparent hover:border-gray-200 hover:shadow-sm'
                    }
                  `}
                  style={{ backgroundColor: cardBg }}
                >
                  <div>
                    <div className="flex items-start gap-2 mb-1">
                      <span className="flex-1 font-medium text-sm text-gray-900 line-clamp-1">
                        {note.title || 'Untitled'}
                      </span>
                      {note.pinned && (
                        <Pin size={11} className="text-violet-500 rotate-45 flex-shrink-0 mt-0.5" />
                      )}
                    </div>

                    {preview && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                        {preview}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {format(noteDate, 'MMM d')}
                      </span>
                      {collection && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: collection.color }}
                        >
                          {collection.name}
                        </span>
                      )}
                      {(note.tags ?? []).slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 text-xs text-gray-400"
                        >
                          <Tag size={9} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreateNote, view }: { onCreateNote: () => void; view: string }) {
  const messages: Record<string, { title: string; sub: string }> = {
    all: { title: 'No notes yet', sub: 'Create your first note to start learning' },
    collection: { title: 'No notes in this collection', sub: 'Create a note and assign it to this collection' },
    tags: { title: 'No tagged notes', sub: 'Add tags to your notes to organize them' },
  };

  const { title, sub } = messages[view] ?? messages['all'];

  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <StickyNote size={28} className="text-gray-300" />
      </div>
      <h3 className="text-sm font-semibold text-gray-500 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-4">{sub}</p>
      <button
        onClick={onCreateNote}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
      >
        <Plus size={14} />
        New Note
      </button>
    </div>
  );
}
