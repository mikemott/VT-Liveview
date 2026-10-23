/**
 * fetchAllIncidents when every source fails (VT 511 feeds mocked to reject).
 */
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { fetchAllIncidents } from '../travelApi';

vi.mock('../vt511Api', () => ({
  fetchVT511Incidents: vi.fn(() => Promise.reject(new Error('VT 511 down'))),
  fetchVT511LaneClosures: vi.fn(() => Promise.reject(new Error('VT 511 closures down'))),
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
