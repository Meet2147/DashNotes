'use client';

import React, { useState } from 'react';
import {
  Plus,
  Pin,
  Lock,
  ArrowUpDown,
  StickyNote,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { db, NOTE_COLORS } from '@/lib/db';
import { useAppStore } from '@/store/useAppStore';
import { useNotes, useCollections } from '@/hooks/useNotes';
import CalendarView from './CalendarView';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export default function NotesList() {
  const {
    selectedNoteId,
    setSelectedNoteId,
    view,
    sortBy,
    setSortBy,
    setMobilePanel,
    searchQuery,
  } = useAppStore();

  const notes = useNotes();
  const collections = useCollections();
  const [showSort, setShowSort] = useState(false);

  const collectionMap = new Map(collections.map((c) => [c.id!, c]));

  const createNote = async () => {
    const id = await db.notes.add({
      title: '',
      content: '',
      tags: [],
      color: NOTE_COLORS[NOTE_COLORS.length - 1],
      pinned: false,
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setSelectedNoteId(id as number);
    setMobilePanel('editor');
  };

  const handleSelectNote = (id: number) => {
    setSelectedNoteId(id);
    setMobilePanel('editor');
  };

  const sortOptions = [
    { value: 'updatedAt', label: 'Last Modified' },
    { value: 'createdAt', label: 'Date Created' },
    { value: 'title', label: 'Title (A-Z)' },
  ] as const;

  const viewTitle = () => {
    switch (view) {
      case 'all': return searchQuery ? `Search: "${searchQuery}"` : 'All Notes';
      case 'collection': return 'Collection';
      case 'calendar': return 'Calendar';
      case 'tags': return 'Tags';
      default: return 'Notes';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
            {viewTitle()}
          </h2>
          <div className="flex items-center gap-1">
            {/* Sort button */}
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                title="Sort"
              >
                <ArrowUpDown size={15} />
              </button>
              {showSort && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 min-w-[160px]">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setShowSort(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        sortBy === opt.value
                          ? 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New Note button */}
            <button
              onClick={createNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </p>
      </div>

      {/* Calendar view embedded in list area */}
      {view === 'calendar' && (
        <div className="border-b border-gray-100 dark:border-gray-700">
          <CalendarView />
        </div>
      )}

      {/* Notes List */}
      <div
        className="flex-1 overflow-y-auto"
        onClick={() => showSort && setShowSort(false)}
      >
        {notes.length === 0 ? (
          <EmptyState onCreateNote={createNote} view={view} />
        ) : (
          <div className="p-2 space-y-1">
            {notes.map((note) => {
              const collection = note.collectionId ? collectionMap.get(note.collectionId) : null;
              const preview = stripHtml(note.content).slice(0, 100);
              const noteDate = note.updatedAt instanceof Date ? note.updatedAt : new Date(note.updatedAt);
              const isSelected = selectedNoteId === note.id;

              // Determine background for card
              const cardBg = note.color && note.color !== '#FFFFFF' ? note.color : undefined;

              return (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note.id!)}
                  className={`
                    w-full text-left p-3 rounded-xl transition-all border-2
                    ${isSelected
                      ? 'border-violet-400 dark:border-violet-500 shadow-sm'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm'
                    }
                  `}
                  style={{
                    backgroundColor: isSelected
                      ? undefined
                      : cardBg,
                  }}
                >
                  <div
                    className={`${isSelected ? 'bg-violet-50 dark:bg-violet-900/20' : ''} rounded-lg`}
                    style={isSelected && cardBg ? { backgroundColor: cardBg } : undefined}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-2 mb-1">
                      <span className="flex-1 font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
                        {note.title || 'Untitled'}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {note.pinned && (
                          <Pin size={11} className="text-violet-500 rotate-45" />
                        )}
                        {note.locked && (
                          <Lock size={11} className="text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    {preview && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                        {preview}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {format(noteDate, 'MMM d')}
                      </span>

                      {collection && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: collection.color }}
                        >
                          {collection.name}
                        </span>
                      )}

                      {note.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 text-xs text-gray-400 dark:text-gray-500"
                        >
                          <Tag size={9} />
                          {tag}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          +{note.tags.length - 2}
                        </span>
                      )}
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
    all: { title: 'No notes yet', sub: 'Create your first note to get started' },
    collection: { title: 'No notes in this collection', sub: 'Create a note and assign it to this collection' },
    calendar: { title: 'No notes for this date', sub: 'Select a different date or create a new note' },
    tags: { title: 'No tagged notes', sub: 'Add tags to your notes to organize them' },
  };

  const { title, sub } = messages[view] ?? messages['all'];

  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        <StickyNote size={28} className="text-gray-300 dark:text-gray-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{sub}</p>
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
