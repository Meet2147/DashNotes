export interface Collection {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: unknown[];
  collection_id: string | null;
  tags: string[];
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPlan {
  user_id: string;
  plan: string;
  monthly_limit: number;
  updated_at: string;
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
