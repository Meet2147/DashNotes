'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Trash2, RotateCcw, Loader2, StickyNote } from 'lucide-react';

interface TrashedNote {
  id: string;
  title: string;
  deletedAt: string;
}

export default function TrashView() {
  const [notes, setNotes] = useState<TrashedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTrashedNotes = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/notes?trash=true');
    if (res.ok) {
      const data = await res.json();
      setNotes(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTrashedNotes();
  }, [loadTrashedNotes]);

  const handleRestore = async (id: string) => {
    setActionLoading(id + '-restore');
    await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    });
    await loadTrashedNotes();
    setActionLoading(null);
  };

  const handleDeleteForever = async (id: string) => {
    if (!confirm('Permanently delete this note? This cannot be undone.')) return;
    setActionLoading(id + '-delete');
    await fetch(`/api/notes/${id}?permanent=true`, { method: 'DELETE' });
    await loadTrashedNotes();
    setActionLoading(null);
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Permanently delete all trashed notes? This cannot be undone.')) return;
    setActionLoading('empty');
    await Promise.all(
      notes.map((n) =>
        fetch(`/api/notes/${n.id}?permanent=true`, { method: 'DELETE' })
      )
    );
    await loadTrashedNotes();
    setActionLoading(null);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 text-base">Trash</h2>
          {notes.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors disabled:opacity-60"
            >
              {actionLoading === 'empty' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Empty trash
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {loading ? 'Loading...' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!loading && notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <StickyNote size={28} className="text-gray-300" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500 mb-1">Trash is empty</h3>
            <p className="text-xs text-gray-400">Deleted notes will appear here</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {notes.map((note) => {
              const deletedAt = note.deletedAt ? new Date(note.deletedAt) : null;
              const isRestoring = actionLoading === note.id + '-restore';
              const isDeleting = actionLoading === note.id + '-delete';

              return (
                <div
                  key={note.id}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50 transition-all"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="flex-1 font-medium text-sm text-gray-700 line-clamp-1">
                      {note.title || 'Untitled'}
                    </span>
                  </div>

                  {deletedAt && (
                    <p className="text-xs text-gray-400 mb-3">
                      Deleted {format(deletedAt, 'MMM d, yyyy')}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(note.id)}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 text-xs font-medium transition-colors disabled:opacity-60"
                    >
                      {isRestoring ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RotateCcw size={11} />
                      )}
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeleteForever(note.id)}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors disabled:opacity-60"
                    >
                      {isDeleting ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                      Delete forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
