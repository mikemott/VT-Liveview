/**
 * Environment variable validation with Zod
 * Ensures required variables are present at runtime
 */

import { z } from 'zod';

/** Frontend environment variable schema */
export const envSchema = z.object({
  /** Protomaps API key for vector tiles (required) */
  VITE_PROTOMAPS_API_KEY: z.string().min(1, 'Protomaps API key is required'),

  /** Backend URL for GraphQL/API calls */
  VITE_BACKEND_URL: z.string().url().optional().default('http://localhost:4000'),

  /** GraphQL endpoint URL */
  VITE_GRAPHQL_ENDPOINT: z.string().url().optional(),

  /** Development mode flag */
  DEV: z.boolean().optional().default(false),

  /** Production mode flag */
  PROD: z.boolean().optional().default(false),

  /** Build mode */
  MODE: z.enum(['development', 'production', 'test']).optional().default('development'),
});

/** Inferred type from schema */
export type Env = z.infer<typeof envSchema>;

/** Validated environment variables */
let validatedEnv: Env | null = null;

/**
 * Validate and return environment variables
 * Throws on first call if required variables are missing
 * Returns cached result on subsequent calls
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  const rawEnv = {
    VITE_PROTOMAPS_API_KEY: import.meta.env.VITE_PROTOMAPS_API_KEY,
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    VITE_GRAPHQL_ENDPOINT: import.meta.env.VITE_GRAPHQL_ENDPOINT,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    MODE: import.meta.env.MODE,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const message = `Environment validation failed:\n${result.error.message}`;

    // In production, throw immediately
    if (import.meta.env.PROD) {
      throw new Error(message);
    }

    // In development, log error but continue with defaults where possible
    console.error(message);

    // Return with defaults for development
    validatedEnv = {
      VITE_PROTOMAPS_API_KEY: rawEnv.VITE_PROTOMAPS_API_KEY ?? '',
      VITE_BACKEND_URL: rawEnv.VITE_BACKEND_URL ?? 'http://localhost:4000',
      VITE_GRAPHQL_ENDPOINT: rawEnv.VITE_GRAPHQL_ENDPOINT,
      DEV: rawEnv.DEV ?? true,
      PROD: rawEnv.PROD ?? false,
      MODE: (rawEnv.MODE as Env['MODE']) ?? 'development',
    };

    return validatedEnv;
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Check if running in development mode
 */
export function isDev(): boolean {
  return getEnv().DEV;
}

/**
 * Check if running in production mode
 */
export function isProd(): boolean {
  return getEnv().PROD;
}
