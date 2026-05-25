// Legacy hooks - replaced by direct Supabase queries in components
// Kept as empty exports for backward compatibility during rebuild

export function useNotes() {
  return [];
}

export function useNote(_id: string | null) {
  return undefined;
}

export function useCollections() {
  return [];
}

export function useNoteDates() {
  return new Set<string>();
}
