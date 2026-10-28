import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { createEvChargerService, networkName, parseStations } from '../evChargers.js';

const AFDC = 'https://developer.nlr.gov/api/alt-fuel-stations/v1.json';
const stationsJson = loadJson<Record<string, unknown>>('afdc/stations-vt.json');

describe('parseStations (VTL-81)', () => {
  const stations = parseStations(stationsJson);

  it('keeps stations with coordinates, sorted by name', () => {
    expect(stations.map((s) => s.name)).toEqual([
      'AC REG PLANNING STATION 1',
      'Alderman’s Chevrolet',
      'Berlin, VT - Tesla Supercharger',
      'Burlington International Airport',
    ]);
  });

  it('reads ports, power, connectors and network', () => {
    expect(stations.find((s) => s.id === '102480')).toMatchObject({
      network: 'Tesla',
      networkUrl: 'https://www.tesla.com/supercharger',
      dcFastPorts: 8,
      level2Ports: 0,
      maxKw: 150,
      connectors: ['NACS (Tesla)'],
      hours: '24 hours daily. Open to Teslas only.',
      facility: 'Hotel',
    });
    expect(stations.find((s) => s.id === '27036')).toMatchObject({
      network: null, // Non-Networked
      dcFastPorts: 0,
      level2Ports: 6,
      connectors: ['J1772', 'NEMA 5-20'],
      pricing: 'Pay lot',
    });
    expect(stations.find((s) => s.id === '44012')?.network).toBe('ChargePoint');
  });

  it('names networks readably', () => {
    expect(networkName('ChargePoint Network')).toBe('ChargePoint');
    expect(networkName('RED_E')).toBe('RED E');
    expect(networkName('Non-Networked')).toBeNull();
    expect(networkName(null)).toBeNull();
  });

  it('tolerates junk', () => {
    expect(parseStations(null)).toEqual([]);
    expect(
      parseStations({ fuel_stations: [null, { id: 1 }, { id: 2, latitude: 0, longitude: 0 }] }),
    ).toEqual([]);
  });
});

describe('createEvChargerService', () => {
  it('asks for open public VT stations, with DEMO_KEY when no key is set', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(AFDC, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(stationsJson);
      }),
    );
    expect(await createEvChargerService(undefined).getStations()).toHaveLength(4);
    await createEvChargerService('KEY').getStations();
    expect(Object.fromEntries(urls[0]!.searchParams)).toEqual({
      api_key: 'DEMO_KEY',
      state: 'VT',
      fuel_type: 'ELEC',
      status: 'E',
      access: 'public',
      limit: 'all',
    });
    expect(urls[1]!.searchParams.get('api_key')).toBe('KEY');
  });
});
