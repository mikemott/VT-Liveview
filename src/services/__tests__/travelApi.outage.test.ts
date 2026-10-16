/**
 * fetchAllIncidents when every source fails. fetchAllVT511Data swallows HTTP
 * errors itself, so it is mocked here to force a rejection.
 */
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { fetchAllIncidents } from '../travelApi';

vi.mock('../vt511Api', () => ({
  fetchAllVT511Data: vi.fn(() => Promise.reject(new Error('VT 511 down'))),
}));

describe('fetchAllIncidents – total outage', () => {
  it('rejects when both VT 511 and USGS fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('https://waterservices.usgs.gov/nwis/iv/', () =>
        HttpResponse.json(null, { status: 503 }),
      ),
    );
    await expect(fetchAllIncidents()).rejects.toThrow('VT 511 down');
  });
});
