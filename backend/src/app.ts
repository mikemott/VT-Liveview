/**
 * VT-Liveview Backend App
 * Fastify + Apollo GraphQL server for weather data APIs.
 */

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
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
import { fetchSkiConditions } from './services/skiConditions.js';
import { createTrafficCameraService } from './services/trafficCameras.js';
import { createRoadWeatherService } from './services/roadWeather.js';
import { validateEnv, isProd } from './types/index.js';
import { getDb, checkDatabaseHealth, isDatabaseEnabled } from './db/index.js';
import { getCollectorStatus } from './scheduler/index.js';

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

  throw new Error(`Could not find schema.graphql. Searched: ${possiblePaths.join(', ')}`);
}

const typeDefs = loadSchema();

/**
 * Health check response type
 */
interface HealthResponse {
  status: string;
  timestamp: string;
  database?: {
    enabled: boolean;
    connected: boolean;
    latencyMs: number | null;
    error?: string;
  };
  collector?: {
    enabled: boolean;
    collectors: Record<
      string,
      {
        lastRun: Date | null;
        lastResult: number | null;
        lastError: string | null;
        nextRun: Date | null;
      }
    >;
  };
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

export interface BuildServerOptions {
  /** Fastify logger setting; tests pass false */
  logger?: boolean;
}

/**
 * Build the Fastify app (plugins, GraphQL, routes) without listening or starting
 * the scheduler. Used by server.ts and by integration tests via fastify.inject().
 */
export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  // Validate environment variables at startup
  const env = validateEnv();

  const fastify = Fastify({
    logger: options.logger ?? true,
  });

  // Parse allowed origins from environment
  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGINS ?? 'https://vtliveview.com')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
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
  // Returns 503 when degraded so Fly's HTTP check (top-level [checks] in fly.toml:
  // monitoring/deploy gating, not routing) reflects a database outage.
  fastify.get('/health', async (_request, reply): Promise<HealthResponse> => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Add database status if configured
    if (isDatabaseEnabled()) {
      const dbHealth = await checkDatabaseHealth();
      response.database = {
        enabled: true,
        connected: dbHealth.connected,
        latencyMs: dbHealth.latencyMs,
        ...(dbHealth.error && { error: dbHealth.error }),
      };

      // Mark as degraded if database is down
      if (!dbHealth.connected) {
        response.status = 'degraded';
      }
    } else {
      response.database = {
        enabled: false,
        connected: false,
        latencyMs: null,
      };
    }

    // Add collector status
    response.collector = getCollectorStatus();

    if (response.status !== 'ok') {
      reply.code(503);
    }
    return response;
  });

  // Admin endpoint to clear weather station cache
  fastify.post(
    '/admin/clear-cache',
    async (
      request: FastifyRequest,
      reply: FastifyReply,
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
          fastify.log.warn(`Failed admin access attempt from IP: ${request.ip}`);
          reply.code(401);
          return { error: 'Unauthorized' };
        }
      }
      const result = clearStationsCache();
      return { ...result, message: 'Weather station cache cleared' };
    },
  );

  // VT 511 proxy endpoints
  const VT_511_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
  const vt511FetchOptions: RequestInit = {
    headers: {
      'User-Agent': `VT-Liveview/1.0 (${env.CONTACT_EMAIL ?? 'weather-app'})`,
    },
  };

  // Relay upstream XML; a non-2xx upstream is reported as 502 instead of a 200 XML body.
  const proxyVt511 = (path: string, dataType: string, label: string): void => {
    fastify.get(path, async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const response = await fetch(
          `${VT_511_BASE}?networks=Vermont&dataTypes=${dataType}`,
          vt511FetchOptions,
        );
        if (!response.ok) {
          reply.code(502).send({ error: `VT 511 upstream returned ${response.status}` });
          return;
        }
        const xmlText = await response.text();
        reply.type('text/xml').send(xmlText);
      } catch {
        reply.code(500).send({ error: `Failed to fetch VT 511 ${label} data` });
      }
    });
  };

  proxyVt511('/api/vt511/incidents', 'incidentData', 'incident');
  proxyVt511('/api/vt511/closures', 'laneClosureData', 'lane closure');
  // Traffic flow data endpoints
  proxyVt511('/api/vt511/traffic-conditions', 'trafficCondData', 'traffic condition');
  proxyVt511('/api/vt511/network', 'networkData', 'network');

  // Traffic cameras (VTL-56). One service per server instance: its caches are
  // per-process, and tests get a fresh one with each buildServer().
  const cameras = createTrafficCameraService(
    `VT-Liveview/1.0 (${env.CONTACT_EMAIL ?? 'weather-app'})`,
  );

  // Road weather stations (VTL-61): pavement temperature, surface condition
  const roadWeather = createRoadWeatherService(
    `VT-Liveview/1.0 (${env.CONTACT_EMAIL ?? 'weather-app'})`,
  );

  fastify.get('/api/road-weather', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stations = await roadWeather.getStations();
      reply.header('Cache-Control', 'public, max-age=120');
      return { stations };
    } catch (error) {
      fastify.log.warn({ err: error }, 'Road weather fetch failed');
      reply.code(502);
      return { error: 'Road weather stations are unavailable' };
    }
  });

  fastify.get('/api/cameras', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const list = await cameras.getCameras();
      reply.header('Cache-Control', 'public, max-age=300');
      return { cameras: list };
    } catch (error) {
      fastify.log.warn({ err: error }, 'Traffic camera list fetch failed');
      reply.code(502);
      return { error: 'Traffic camera list is unavailable' };
    }
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/cameras/:id/snapshot.jpg',
    async (request, reply): Promise<void> => {
      try {
        const snapshot = await cameras.getSnapshot(request.params.id);
        if (!snapshot) {
          reply.code(404).send({ error: 'No current image for this camera' });
          return;
        }
        reply.type('image/jpeg').header('Cache-Control', 'public, max-age=60');
        // Unknown capture time: send no Last-Modified rather than pretend it's new
        if (snapshot.takenAt) {
          reply.header('Last-Modified', new Date(snapshot.takenAt).toUTCString());
        }
        reply.send(snapshot.jpeg);
      } catch (error) {
        fastify.log.warn({ err: error }, 'Traffic camera snapshot fetch failed');
        reply.code(502).send({ error: 'Traffic camera images are unavailable' });
      }
    },
  );

  // Ski conditions cache refresh endpoint
  fastify.post(
    '/api/ski-conditions/refresh',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const resorts = await fetchSkiConditions();
        return {
          success: true,
          updated: new Date().toISOString(),
          resortCount: resorts.length,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reply.code(500);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  // Initialize database connection (if configured)
  if (isDatabaseEnabled()) {
    const db = getDb();
    if (db) {
      fastify.log.info('Database connection established');
    }
  } else {
    fastify.log.info('Database not configured, historical data features disabled');
  }

  // Start server
  return fastify;
}
