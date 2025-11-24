/**
 * Node.js server entry point
 * Runs Hono app with @hono/node-server
 */

import { serve } from '@hono/node-server';
import * as dotenv from 'dotenv';
import app from './index.js';
import { getPool, closePool } from './db.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8787', 10);

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('WARNING: OPENAI_API_KEY is not set. AI features will not work.');
}

// Initialize database connection
try {
  getPool();
  console.log('[Server] Database connection pool initialized');
} catch (error) {
  console.error('[Server] Failed to initialize database:', error);
  process.exit(1);
}

// Start server
serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`✅ Server is running on http://localhost:${PORT}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});
