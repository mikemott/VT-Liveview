/**
 * Environment variable validation using Zod.
 * Validates and types all environment variables at startup.
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server configuration
  PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535)),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // CORS configuration (production only)
  ALLOWED_ORIGINS: z.string().optional(),

  // Admin authentication
  ADMIN_TOKEN: z.string().optional(),

  // NOAA API configuration
  CONTACT_EMAIL: z.string().email().optional(),
  NOAA_CDO_TOKEN: z.string().optional(), // Token for NOAA Climate Data Online API

  // Sentry configuration (optional)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables against the schema.
 * Throws an error with detailed message if validation fails.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return result.data;
}

/**
 * Type-safe access to validated environment variables.
 * Call validateEnv() once at startup, then use getEnv() throughout the app.
 */
let validatedEnv: Env | null = null;

export function getEnv(): Env {
  if (!validatedEnv) {
    validatedEnv = validateEnv();
  }
  return validatedEnv;
}

/**
 * Check if we're in development mode.
 */
export function isDev(): boolean {
  return getEnv().NODE_ENV === 'development';
}

/**
 * Check if we're in production mode.
 */
export function isProd(): boolean {
  return getEnv().NODE_ENV === 'production';
}
