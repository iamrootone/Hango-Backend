-- HanGo Database Schema (PostgreSQL)
-- Run this file on Railway PostgreSQL to create the initial schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_due_check_date TIMESTAMP,
  last_review_rollover_date TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Vocabulary words table (read-only reference data)
CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY,
  korean TEXT NOT NULL,
  number INTEGER NOT NULL, -- Sense number for homonyms (1, 2, 3...)
  english TEXT NOT NULL, -- JSON array as text
  pos TEXT NOT NULL,
  level INTEGER NOT NULL,
  examples TEXT NOT NULL, -- JSON array as text
  note TEXT, -- JSON object as text
  UNIQUE(korean, number) -- Prevent duplicate sense numbers for same word
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_level ON vocabulary(level);
CREATE INDEX IF NOT EXISTS idx_vocabulary_korean ON vocabulary(korean);

-- User word progress table
CREATE TABLE IF NOT EXISTS word_progress (
  user_id TEXT NOT NULL,
  vocab_id TEXT NOT NULL,
  dday INTEGER DEFAULT 0,
  review INTEGER DEFAULT 0, -- 0 = false, 1 = true
  latest_time TIMESTAMP DEFAULT NOW(),
  next_review_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, vocab_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (vocab_id) REFERENCES vocabulary(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_word_progress_user_review ON word_progress(user_id, review);
CREATE INDEX IF NOT EXISTS idx_word_progress_user_dday ON word_progress(user_id, dday);
CREATE INDEX IF NOT EXISTS idx_word_progress_next_review ON word_progress(user_id, next_review_at);

-- User progress summary (cached counts)
CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT PRIMARY KEY,
  voca_completed INTEGER DEFAULT 0,
  voca_learning INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat summary table for conversation memory
CREATE TABLE IF NOT EXISTS chat_summaries (
  thread_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ai_friend_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  summarized_message_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_summaries_user ON chat_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_updated ON chat_summaries(updated_at);
