import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ApolloServer } from '@apollo/server';
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolvers } from './resolvers/index.js';
import { clearStationsCache } from './services/noaa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read GraphQL schema
const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

async function start() {
  const fastify = Fastify({
    logger: true
  });

  // Enable CORS for frontend
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.ALLOWED_ORIGINS || 'https://vtliveview.com').split(',')
      : true, // Allow all origins in development
    methods: ['GET', 'POST', 'OPTIONS']
  });

  // Create Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [fastifyApolloDrainPlugin(fastify)],
    introspection: true // Enable GraphQL playground
  });

  await apollo.start();

  // Register Apollo handler
  fastify.post('/graphql', fastifyApolloHandler(apollo));
  fastify.get('/graphql', fastifyApolloHandler(apollo));

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Admin endpoint to clear weather station cache
  fastify.post('/admin/clear-cache', async (request, reply) => {
    // Require auth token in production
    if (process.env.NODE_ENV === 'production') {
      const adminToken = request.headers['x-admin-token'];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }
    const result = clearStationsCache();
    return { ...result, message: 'Weather station cache cleared' };
  });

  // VT 511 proxy endpoints
  const VT_511_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';

  fastify.get('/api/vt511/incidents', async (request, reply) => {
    try {
      const response = await fetch(`${VT_511_BASE}?networks=Vermont&dataTypes=incidentData`);
      const xmlText = await response.text();
      reply.type('text/xml').send(xmlText);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch VT 511 incident data' });
    }
  });

  fastify.get('/api/vt511/closures', async (request, reply) => {
    try {
      const response = await fetch(`${VT_511_BASE}?networks=Vermont&dataTypes=laneClosureData`);
      const xmlText = await response.text();
      reply.type('text/xml').send(xmlText);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch VT 511 lane closure data' });
    }
  });

  // Start server
  const port = process.env.PORT || 4000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 GraphQL server ready at http://${host}:${port}/graphql`);
    fastify.log.info(`📊 Health check at http://${host}:${port}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
