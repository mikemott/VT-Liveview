/**
 * Shared MSW server for frontend tests. Tests register per-case handlers with
 * `server.use(...)`; unhandled outbound requests fail the test.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Defaults that survive resetHandlers(). Air quality (VTL-75) loads alongside
 * the weather card and What's here; by default it answers "not configured",
 * which the UI shows as no air quality line. Tests that need it override this.
 */
export const defaultHandlers = [
  http.get('*/api/air-quality', () =>
    HttpResponse.json({ configured: false, current: null, forecast: [] }),
  ),
];

export const server = setupServer(...defaultHandlers);
