import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note } from '@/lib/db';
import { useAppStore } from '@/store/useAppStore';

export function useNotes() {
  const { searchQuery, selectedCollectionId, view, sortBy, calendarSelectedDate } = useAppStore();

  const notes = useLiveQuery(async () => {
    let collection = db.notes.orderBy(sortBy === 'title' ? 'title' : sortBy === 'createdAt' ? 'createdAt' : 'updatedAt');

    let results: Note[] = await collection.reverse().toArray();

    // Filter by view/collection
    if (view === 'collection' && selectedCollectionId !== null) {
      results = results.filter((n) => n.collectionId === selectedCollectionId);
    }

    // Filter by calendar date
    if (view === 'calendar' && calendarSelectedDate) {
      const selectedDate = new Date(calendarSelectedDate);
      results = results.filter((n) => {
        const noteDate = new Date(n.createdAt);
        return (
          noteDate.getFullYear() === selectedDate.getFullYear() &&
          noteDate.getMonth() === selectedDate.getMonth() &&
          noteDate.getDate() === selectedDate.getDate()
        );
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort title alphabetically if needed
    if (sortBy === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Pinned notes first
    results.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    return results;
  }, [searchQuery, selectedCollectionId, view, sortBy, calendarSelectedDate]);

  return notes ?? [];
}

export function useNote(id: number | null) {
  return useLiveQuery(async () => {
    if (id === null) return null;
    return await db.notes.get(id);
  }, [id]);
}

export function useCollections() {
  return useLiveQuery(() => db.collections.orderBy('createdAt').toArray(), []) ?? [];
}

export function useNoteDates() {
  return useLiveQuery(async () => {
    const all = await db.notes.toArray();
    const dates = new Set<string>();
    all.forEach((n) => {
      const d = new Date(n.createdAt);
      dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    });
    return dates;
  }, []) ?? new Set<string>();
}
