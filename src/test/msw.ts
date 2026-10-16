/**
 * Shared MSW server for frontend tests. Tests register per-case handlers with
 * `server.use(...)`; unhandled outbound requests fail the test.
 */
import { setupServer } from 'msw/node';

export const server = setupServer();
