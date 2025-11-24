/**
 * Database connection and query utilities
 * PostgreSQL client for Railway deployment
 */

import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    console.log('[DB] PostgreSQL connection pool created');
  }

  return pool;
}

/**
 * Execute a query with parameters
 */
export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  console.log('[DB] Query executed', { text: text.substring(0, 50), duration, rows: result.rowCount });
  return result;
}

/**
 * Get a single row
 */
export async function queryOne<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Connection pool closed');
  }
}
