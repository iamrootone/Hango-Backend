import { Hono } from 'hono';
import type { WordProgress } from '../types/index.js';
import { verifyJWT } from '../utils/jwt.js';
import { query, queryOne } from '../db.js';

type Variables = {
  userId: string;
};

const vocabulary = new Hono<{ Variables: Variables }>();

// Middleware to verify authentication
vocabulary.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('userId', payload.userId);
  await next();
});

// Helper: Get next review date (midnight local time)
function getNextReviewDate(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

// Helper: Get next Dday based on spaced repetition
function getNextDday(currentDday: number): number {
  if (currentDday >= 365) return 365;
  if (currentDday >= 30) return 365;
  if (currentDday >= 7) return 30;
  if (currentDday >= 3) return 7;
  if (currentDday >= 1) return 3;
  return 1;
}

// Get learning session (10 words: review first, then new)
vocabulary.get('/session', async (c) => {
  try {
    const userId = c.get('userId');
    const sessionSize = 10;

    // Get review words (review = 1)
    const reviewWords = await query(
      `SELECT v.*, wp.dday, wp.review
       FROM vocabulary v
       INNER JOIN word_progress wp ON v.id = wp.vocab_id
       WHERE wp.user_id = $1 AND wp.review = 1
       LIMIT $2`,
      [userId, sessionSize]
    );

    const reviewCount = reviewWords.rows.length;
    const remaining = sessionSize - reviewCount;

    // Get new words (not in word_progress)
    const newWords = remaining > 0 ? await query(
      `SELECT v.* FROM vocabulary v
       WHERE v.id NOT IN (
         SELECT vocab_id FROM word_progress WHERE user_id = $1
       )
       LIMIT $2`,
      [userId, remaining]
    ) : { rows: [] };

    const words = [
      ...reviewWords.rows,
      ...newWords.rows,
    ].map((row: any) => ({
      id: row.id,
      korean: row.korean,
      number: row.number,
      english: JSON.parse(row.english),
      pos: row.pos,
      level: row.level,
      examples: JSON.parse(row.examples),
      note: row.note ? JSON.parse(row.note) : undefined,
    }));

    // Get user progress for these words
    const vocabIds = words.map(w => w.id);
    const progressData = vocabIds.length > 0 ? await query(
      `SELECT * FROM word_progress WHERE user_id = $1 AND vocab_id = ANY($2::text[])`,
      [userId, vocabIds]
    ) : { rows: [] };

    const progress: { [key: string]: any } = {};
    progressData.rows.forEach((row: any) => {
      progress[row.vocab_id] = {
        vocabId: row.vocab_id,
        dday: row.dday,
        review: row.review === 1,
        latestTime: row.latest_time,
        nextReviewAt: row.next_review_at,
      };
    });

    return c.json({ words, progress });
  } catch (error) {
    console.error('Get session error:', error);
    return c.json({ error: 'Failed to get learning session' }, 500);
  }
});

// Submit answer
vocabulary.post('/answer', async (c) => {
  try {
    const userId = c.get('userId');
    const { vocabId, correct } = await c.req.json();

    if (!vocabId || typeof correct !== 'boolean') {
      return c.json({ error: 'Invalid request' }, 400);
    }

    // Get current progress
    const existing = await queryOne<WordProgress>(
      'SELECT * FROM word_progress WHERE user_id = $1 AND vocab_id = $2',
      [userId, vocabId]
    );

    let newDday: number;
    let review: number;
    const now = new Date().toISOString();

    if (!existing) {
      // First time seeing this word
      if (correct) {
        newDday = 365; // Mastered immediately
        review = 0;
      } else {
        newDday = 0;
        review = 1; // Review today
      }

      await query(
        `INSERT INTO word_progress (user_id, vocab_id, dday, review, latest_time, next_review_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, vocabId, newDday, review, now, getNextReviewDate(newDday)]
      );
    } else {
      // Update existing progress
      if (correct) {
        newDday = existing.dday === 365 ? 365 : getNextDday(existing.dday);
        review = 0;
      } else {
        newDday = 0;
        review = 1;
      }

      await query(
        `UPDATE word_progress
         SET dday = $1, review = $2, latest_time = $3, next_review_at = $4
         WHERE user_id = $5 AND vocab_id = $6`,
        [newDday, review, now, getNextReviewDate(newDday), userId, vocabId]
      );
    }

    // Update user progress summary
    const completed = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int as count FROM word_progress WHERE user_id = $1 AND dday = 365',
      [userId]
    );

    const learning = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int as count FROM word_progress WHERE user_id = $1 AND dday < 365',
      [userId]
    );

    await query(
      `INSERT INTO user_progress (user_id, voca_completed, voca_learning, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(user_id) DO UPDATE SET
         voca_completed = EXCLUDED.voca_completed,
         voca_learning = EXCLUDED.voca_learning,
         updated_at = EXCLUDED.updated_at`,
      [userId, completed?.count || 0, learning?.count || 0, now]
    );

    return c.json({
      vocaCompleted: completed?.count || 0,
      vocaLearning: learning?.count || 0,
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return c.json({ error: 'Failed to submit answer' }, 500);
  }
});

// Get user progress
vocabulary.get('/progress', async (c) => {
  try {
    const userId = c.get('userId');

    const progress = await queryOne<any>(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [userId]
    );

    return c.json({
      vocaCompleted: progress?.voca_completed || 0,
      vocaLearning: progress?.voca_learning || 0,
    });
  } catch (error) {
    console.error('Get progress error:', error);
    return c.json({ error: 'Failed to get progress' }, 500);
  }
});

// Search vocabulary
vocabulary.get('/search', async (c) => {
  try {
    const searchQuery = c.req.query('q') || '';

    if (!searchQuery) {
      return c.json([]);
    }

    const results = await query(
      `SELECT * FROM vocabulary
       WHERE korean LIKE $1 OR english LIKE $2
       LIMIT 50`,
      [`%${searchQuery}%`, `%${searchQuery}%`]
    );

    const words = results.rows.map((row: any) => ({
      id: row.id,
      korean: row.korean,
      number: row.number,
      english: JSON.parse(row.english),
      pos: row.pos,
      level: row.level,
      examples: JSON.parse(row.examples),
      note: row.note ? JSON.parse(row.note) : undefined,
    }));

    return c.json(words);
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Failed to search' }, 500);
  }
});

// Get all vocabulary (for dictionary)
vocabulary.get('/all', async (c) => {
  try {
    const results = await query(
      'SELECT * FROM vocabulary ORDER BY level, korean, number'
    );

    const words = results.rows.map((row: any) => ({
      id: row.id,
      korean: row.korean,
      number: row.number,
      english: JSON.parse(row.english),
      pos: row.pos,
      level: row.level,
      examples: JSON.parse(row.examples),
      note: row.note ? JSON.parse(row.note) : undefined,
    }));

    return c.json(words);
  } catch (error) {
    console.error('Get all vocabulary error:', error);
    return c.json({ error: 'Failed to get vocabulary' }, 500);
  }
});

export default vocabulary;
