/**
 * Backend entrypoint for Playwright E2E runs: the real app (buildServer) with
 * every upstream answered by MSW fixtures. Unmocked outbound requests fail
 * loudly instead of reaching the internet.
 *
 * Run from backend/: node --import tsx src/test/e2e-server.ts
 * (the `npm run e2e:server` script). No DATABASE_URL, so collectors stay off.
 */
import { setupServer } from 'msw/node';
import { buildServer } from '../app.js';
import { validateEnv } from '../types/index.js';
import { upstreamHandlers } from './upstreamHandlers.js';

const mock = setupServer(...upstreamHandlers);
mock.listen({ onUnhandledRequest: 'error' });

const env = validateEnv();
const app = await buildServer();
await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(`E2E backend (mocked upstreams) listening on ${env.HOST}:${env.PORT}`);

const shutdown = (): void => {
  void app.close().finally(() => {
    mock.close();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
