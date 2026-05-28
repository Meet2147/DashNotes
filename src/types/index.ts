export interface Collection {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: unknown[]; // BlockNote JSON blocks
  tags: string[];
  color: string;
  pinned: boolean;
  collectionId: string | null;
  collection?: { id: string; name: string; color: string } | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPlan {
  userId: string;
  plan: string;
  monthlyLimit: number;
  updatedAt: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
