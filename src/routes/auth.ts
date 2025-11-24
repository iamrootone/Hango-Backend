import { Hono } from 'hono';
import type { User } from '../types/index.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signJWT, verifyJWT } from '../utils/jwt.js';
import { query, queryOne } from '../db.js';

const auth = new Hono();

// Signup
auth.post('/signup', async (c) => {
  try {
    const { email, password, nickname } = await c.req.json();

    // Validation
    if (!email || !password || !nickname) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Check if user exists
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    // Create user
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await query(
      `INSERT INTO users (id, email, password_hash, nickname, level, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, email, passwordHash, nickname, 0]
    );

    // Initialize user progress
    await query(
      `INSERT INTO user_progress (user_id, voca_completed, voca_learning)
       VALUES ($1, 0, 0)`,
      [userId]
    );

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = await signJWT({ userId, email }, jwtSecret);

    return c.json({
      token,
      user: {
        id: userId,
        email,
        nickname,
        level: 0,
        createdAt: new Date().toISOString(),
      },
    }, 201);
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Failed to create account' }, 500);
  }
});

// Login
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Missing email or password' }, 400);
    }

    // Find user
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = await signJWT(
      { userId: user.id, email: user.email },
      jwtSecret
    );

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        level: user.level,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Failed to login' }, 500);
  }
});

// Get current user
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const user = await queryOne<Omit<User, 'password_hash'>>(
      'SELECT id, email, nickname, level, created_at FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      level: user.level,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

export default auth;
