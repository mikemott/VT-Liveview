/**
 * Database connection singleton using Drizzle ORM.
 * Supports Neon/Supabase serverless PostgreSQL.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv, isDev } from '../types/env.js';
import * as schema from './schema.js';

// Database client singleton
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sql: ReturnType<typeof postgres> | null = null;

/**
 * Get the database connection.
 * Creates a new connection if one doesn't exist.
 * Returns null if DATABASE_URL is not configured.
 */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> | null {
  const env = getEnv();

  if (!env.DATABASE_URL) {
    if (isDev()) {
      console.log('[DB] DATABASE_URL not configured, database features disabled');
    }
    return null;
  }

  if (!db) {
    // Configure connection for serverless (Neon/Supabase)
    sql = postgres(env.DATABASE_URL, {
      max: 5, // Connection pool size (suitable for 256MB instance)
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
      prepare: false, // Required for Neon/Supabase connection pooling
    });

    db = drizzle(sql, { schema });

    if (isDev()) {
      console.log('[DB] Database connection established');
    }
  }

  return db;
}

/**
 * Check if database is configured and available.
 */
export function isDatabaseEnabled(): boolean {
  return !!getEnv().DATABASE_URL;
}

/**
 * Health check for database connection.
 * Returns latency in milliseconds or null if unavailable.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number | null;
  error?: string;
}> {
  const database = getDb();

  if (!database || !sql) {
    return { connected: false, latencyMs: null };
  }

  try {
    const start = Date.now();
    await sql`SELECT 1`;
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully close the database connection.
 * Call this during server shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
    db = null;
    if (isDev()) {
      console.log('[DB] Database connection closed');
    }
  }
}

// Re-export schema for convenience
export * from './schema.js';
