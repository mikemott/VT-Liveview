import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { vtransLookup } from '../../test/upstreamHandlers.js';
import {
  VTRANS_511_LOOKUP,
  addressBlock,
  compassDirection,
  createCameraLocationService,
  interstateCode,
  lookupCameraLocation,
  milesBetween,
  routeAddressPattern,
  streetPattern,
  titleCase,
  townName,
} from '../cameraLocations.js';

const BERLIN = { lat: 44.21232, lng: -72.58338, roadway: 'I-89' };
const STOWE = { lat: 44.558, lng: -72.794, roadway: 'VT-108' };

/** Answers like VTrans, and records each query */
function useVtrans(): URL[] {
  const calls: URL[] = [];
  server.use(
    http.get(`${VTRANS_511_LOOKUP}/:layer/query`, ({ request, params }) => {
      const url = new URL(request.url);
      calls.push(url);
      return HttpResponse.json(vtransLookup(url, String(params.layer)));
    }),
  );
  return calls;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('helpers', () => {
  it('measures distance and compass direction', () => {
    // One degree of latitude is about 69 miles
    expect(milesBetween(44, -72.5, 45, -72.5)).toBeCloseTo(69.1, 0);
    expect(compassDirection(44, -72.5, 44.1, -72.5)).toBe('north');
    expect(compassDirection(44, -72.5, 43.9, -72.4)).toBe('southeast');
    expect(compassDirection(44, -72.5, 44, -72.6)).toBe('west');
  });

  it('formats VTrans names for people', () => {
    expect(titleCase('US ROUTE 2')).toBe('US Route 2');
    expect(titleCase('VT ROUTE 22A')).toBe('VT Route 22A');
    expect(titleCase('GRAND ISLE')).toBe('Grand Isle');
    expect(townName('Town of Brookfield', 'BROOKFIELD')).toBe('Brookfield');
    expect(townName('City of South Burlington', null)).toBe('South Burlington');
    expect(townName('Urban Compact of Milton', null)).toBe('Milton');
    expect(townName('', 'SAINT JOHNSBURY')).toBe('Saint Johnsbury');
    expect(townName(null, null)).toBeNull();
  });

  it('maps roadways to VTrans codes and street names', () => {
    expect(interstateCode('I-89')).toBe('I089');
    expect(interstateCode('I-189')).toBe('I189');
    expect(interstateCode('US-2')).toBeNull();
    const us2 = routeAddressPattern('US-2')!;
    expect(us2.test('US ROUTE 2')).toBe(true);
    expect(us2.test('ROUTE 2')).toBe(true);
    expect(us2.test('US ROUTE 2 N')).toBe(true);
    expect(us2.test('OLD ROUTE 2')).toBe(false);
    expect(us2.test('US ROUTE 2A')).toBe(false);
    expect(routeAddressPattern('I-89')).toBeNull();
    const us7 = streetPattern('US-7', ['FRANKLIN ST'])!;
    expect(us7.test('FRANKLIN ST')).toBe(true);
    expect(us7.test('US ROUTE 7')).toBe(true);
    expect(us7.test('FRANKLIN STREET')).toBe(false);
  });

  it('rounds addresses to a block on the camera road only', () => {
    const us2 = routeAddressPattern('US-2')!;
    expect(addressBlock('4220 US ROUTE 2', us2)).toBe('4200 block of US Route 2');
    // The direction letter only marks a divided stretch
    expect(addressBlock('3012 US ROUTE 2 N', us2)).toBe('3000 block of US Route 2');
    expect(addressBlock('85 OLD ROUTE 2', us2)).toBeNull();
    expect(addressBlock('45 US ROUTE 2', us2)).toBeNull();
  });
});

describe('lookupCameraLocation (VTL-94)', () => {
  it('gives an interstate camera its mile marker and nearest exit', async () => {
    const calls = useVtrans();
    expect(await lookupCameraLocation(fetch, BERLIN)).toEqual({
      town: 'Berlin',
      county: 'Washington',
      // The ramp's own mileage (0.1) is closer, but isn't the posted marker
      milepost: 50.1,
      nearestExit: { number: '7', name: 'Berlin–Barre', distanceMi: 0.2, direction: 'south' },
      // The median U-turn isn't a street name
      streetName: null,
      addressBlock: null,
      speedLimitMph: 65,
    });
    // Interstates don't need the address lookup
    expect(calls.map((c) => c.pathname.split('/').at(-2)).sort()).toEqual(['0', '12', '16', '3']);
  });

  it('gives other roads their local name and address block', async () => {
    useVtrans();
    expect(await lookupCameraLocation(fetch, STOWE)).toEqual({
      town: 'Stowe',
      county: 'Lamoille',
      milepost: null,
      nearestExit: null,
      streetName: 'Mountain Rd',
      // 12 Side Rd is closer but on another street
      addressBlock: '6900 block of Mountain Rd',
      speedLimitMph: 50,
    });
  });

  it('asks for the camera road only, with escaped quotes', async () => {
    const calls = useVtrans();
    await lookupCameraLocation(fetch, { ...STOWE, roadway: "VT-1'08" });
    const road = calls.find((c) => c.pathname.endsWith('/12/query'))!;
    expect(road.searchParams.get('where')).toBe("HWYSIGN='VT-1''08'");
    expect(road.searchParams.get('geometry')).toBe('-72.794,44.558');
  });

  it('fails on an ArcGIS error reported with HTTP 200', async () => {
    server.use(
      http.get(`${VTRANS_511_LOOKUP}/:layer/query`, () =>
        HttpResponse.json({ error: { code: 400, message: 'Invalid query' } }),
      ),
    );
    await expect(lookupCameraLocation(fetch, BERLIN)).rejects.toThrow(
      'VTrans lookup error: Invalid query',
    );
  });

  it('times out a hung lookup', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    useVtrans();
    await expect(lookupCameraLocation(fetch, BERLIN)).rejects.toThrow();
    const delays = timeout.mock.calls.map(([ms]) => ms);
    timeout.mockRestore();
    expect(delays).toContain(10_000);
  });
});

describe('createCameraLocationService', () => {
  it('caches each camera for a week and serves the last answer when VTrans fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const calls = useVtrans();
    const service = createCameraLocationService();

    const first = await service.get('I-89 SB BERLIN', BERLIN);
    const n = calls.length;
    await service.get('I-89 SB BERLIN', BERLIN);
    expect(calls.length).toBe(n);

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    server.use(
      http.get(`${VTRANS_511_LOOKUP}/:layer/query`, () => new HttpResponse(null, { status: 503 })),
    );
    expect(await service.get('I-89 SB BERLIN', BERLIN)).toEqual(first);
  });
});
