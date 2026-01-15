/**
 * VT-Liveview Backend Server
 * Fastify + Apollo GraphQL server for weather data APIs.
 */

import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { timingSafeEqual } from 'crypto';
import { ApolloServer } from '@apollo/server';
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolvers } from './resolvers/index.js';
import { clearStationsCache } from './services/noaa.js';
import { validateEnv, isProd, isDev } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read GraphQL schema - handle both development (src/) and production (dist/) paths
function loadSchema(): string {
  const possiblePaths = [
    join(__dirname, 'schema.graphql'), // Development: running from src/
    join(__dirname, '..', 'src', 'schema.graphql'), // Production: running from dist/
  ];

  for (const schemaPath of possiblePaths) {
    try {
      return readFileSync(schemaPath, 'utf-8');
    } catch {
      // Try next path
    }
  }

  throw new Error(
    `Could not find schema.graphql. Searched: ${possiblePaths.join(', ')}`
  );
}

const typeDefs = loadSchema();

/**
 * Health check response type
 */
interface HealthResponse {
  status: string;
  timestamp: string;
}

/**
 * Cache clear response type
 */
interface CacheClearResponse {
  cleared: boolean;
  timestamp: string;
  message: string;
}

/**
 * Error response type
 */
interface ErrorResponse {
  error: string;
}

async function start(): Promise<void> {
  // Validate environment variables at startup
  const env = validateEnv();

  const fastify = Fastify({
    logger: true,
  });

  // Parse allowed origins from environment
  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGINS ?? 'https://vtliveview.com')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  // Enable CORS with origin validation callback
  await fastify.register(cors, {
    origin: isProd()
      ? (origin, callback) => {
          // Allow requests with no origin (same-origin, curl, etc.)
          if (!origin) {
            callback(null, true);
            return;
          }
          // Validate against allowlist
          if (allowedOrigins.has(origin)) {
            callback(null, true);
          } else {
            fastify.log.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'), false);
          }
        }
      : true, // Allow all origins in development
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 86400, // Cache preflight responses for 24 hours
  });

  // Rate limiting for proxy endpoints (100 requests per minute)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Only apply to API routes, not GraphQL or health
    allowList: (request) => {
      const url = request.url;
      return url === '/health' || url === '/graphql';
    },
  });

  // Create Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [fastifyApolloDrainPlugin(fastify)],
    introspection: true, // Enable GraphQL playground
  });

  await apollo.start();

  // Register Apollo handler
  fastify.post('/graphql', fastifyApolloHandler(apollo));
  fastify.get('/graphql', fastifyApolloHandler(apollo));

  // Health check endpoint
  fastify.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Admin endpoint to clear weather station cache
  fastify.post(
    '/admin/clear-cache',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<CacheClearResponse | ErrorResponse> => {
      // Require auth token in production
      if (isProd()) {
        const adminToken = request.headers['x-admin-token'];

        // Check if admin token is configured
        if (!env.ADMIN_TOKEN) {
          fastify.log.error('Admin endpoint accessed but ADMIN_TOKEN not configured');
          reply.code(401);
          return { error: 'Unauthorized' };
        }

        // Use timing-safe comparison to prevent timing attacks
        const tokenValid =
          typeof adminToken === 'string' &&
          adminToken.length === env.ADMIN_TOKEN.length &&
          timingSafeEqual(Buffer.from(adminToken), Buffer.from(env.ADMIN_TOKEN));

        if (!tokenValid) {
          // Log failed access attempts with IP (but not the attempted token)
          // Note: Only use request.ip (derived from socket) since trustProxy is not enabled.
          // x-forwarded-for can be spoofed without a trusted proxy configuration.
          fastify.log.warn(
            `Failed admin access attempt from IP: ${request.ip}`
          );
          reply.code(401);
          return { error: 'Unauthorized' };
        }
      }
      const result = clearStationsCache();
      return { ...result, message: 'Weather station cache cleared' };
    }
  );

  // VT 511 proxy endpoints
  const VT_511_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
  const vt511FetchOptions: RequestInit = {
    headers: {
      'User-Agent': `VT-Liveview/1.0 (${env.CONTACT_EMAIL ?? 'weather-app'})`,
    },
  };

  fastify.get(
    '/api/vt511/incidents',
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const response = await fetch(
          `${VT_511_BASE}?networks=Vermont&dataTypes=incidentData`,
          vt511FetchOptions
        );
        const xmlText = await response.text();
        reply.type('text/xml').send(xmlText);
      } catch {
        reply.code(500).send({ error: 'Failed to fetch VT 511 incident data' });
      }
    }
  );

  fastify.get(
    '/api/vt511/closures',
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const response = await fetch(
          `${VT_511_BASE}?networks=Vermont&dataTypes=laneClosureData`,
          vt511FetchOptions
        );
        const xmlText = await response.text();
        reply.type('text/xml').send(xmlText);
      } catch {
        reply.code(500).send({ error: 'Failed to fetch VT 511 lane closure data' });
      }
    }
  );

  // Start server
  const port = env.PORT;
  const host = env.HOST;

  try {
    await fastify.listen({ port, host });

    if (isDev()) {
      fastify.log.info(`GraphQL server ready at http://${host}:${port}/graphql`);
      fastify.log.info(`Health check at http://${host}:${port}/health`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
