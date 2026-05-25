import Dexie, { Table } from 'dexie';

export interface Note {
  id?: number;
  title: string;
  content: string; // HTML string from TipTap
  collectionId?: number;
  tags: string[];
  color: string;
  pinned: boolean;
  locked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Collection {
  id?: number;
  name: string;
  color: string;
  createdAt: Date;
}

export class DashNotesDB extends Dexie {
  notes!: Table<Note, number>;
  collections!: Table<Collection, number>;

  constructor() {
    super('DashNotesDB');
    this.version(1).stores({
      notes: '++id, title, collectionId, createdAt, updatedAt, pinned, locked',
      collections: '++id, name, createdAt',
    });
  }
}

export const db = new DashNotesDB();

export const NOTE_COLORS = [
  '#FFF3CD',
  '#D1FAE5',
  '#DBEAFE',
  '#FCE7F3',
  '#F3E8FF',
  '#FEE2E2',
  '#FFFFFF',
];

export const COLLECTION_COLORS = [
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#DC2626',
  '#D97706',
  '#DB2777',
  '#0891B2',
  '#65A30D',
];
