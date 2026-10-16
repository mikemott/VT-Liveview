/**
 * VT-LiveView backend entrypoint: builds the app, listens, starts the scheduler
 * and wires graceful shutdown. App construction lives in app.ts.
 */

import { buildServer } from './app.js';
import { validateEnv, isDev } from './types/index.js';
import { closeDatabase } from './db/index.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';

async function start(): Promise<void> {
  const env = validateEnv();
  const fastify = await buildServer();

  const port = env.PORT;
  const host = env.HOST;

  try {
    await fastify.listen({ port, host });

    if (isDev()) {
      fastify.log.info(`GraphQL server ready at http://${host}:${port}/graphql`);
      fastify.log.info(`Health check at http://${host}:${port}/health`);
    }

    // Start data collection scheduler after server is ready
    const schedulerStarted = startScheduler();
    if (schedulerStarted) {
      fastify.log.info('Data collection scheduler started');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);

    // Stop scheduler first
    stopScheduler();

    // Close database connection
    await closeDatabase();

    // Close Fastify server
    await fastify.close();

    fastify.log.info('Server shut down successfully');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
