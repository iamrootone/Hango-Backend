export interface User {
  id: string;
  email: string;
  password_hash: string;
  nickname: string;
  level: number;
  created_at: string;
}

export interface WordProgress {
  user_id: string;
  vocab_id: string;
  dday: number;
  review: number;
  latest_time: string;
  next_review_at: string;
}

export interface Vocabulary {
  id: string;
  korean: string;
  number: number;
  english: string[];
  pos: string;
  level: number;
  examples: Array<{
    korean: string;
    english: string;
    problems: string[];
    answer: string;
  }>;
  note?: {
    korean: string;
    english: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
}
