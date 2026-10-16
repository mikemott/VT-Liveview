import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from '../../db/__tests__/fakeDb.js';
import type { NewWeatherObservation } from '../../db/schema.js';
import type { ObservationStation, StationWeather } from '../../types/index.js';

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getObservationStations: vi.fn() }));
vi.mock('../../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/index.js')>()),
  getDb: mocks.getDb,
}));
vi.mock('../../services/noaa.js', () => ({
  getObservationStations: mocks.getObservationStations,
}));

const { collectWeatherObservations } = await import('../weather.js');

function station(id: string, weather: Partial<StationWeather> = {}): ObservationStation {
  return {
    id,
    name: `Station ${id}`,
    location: { lat: 44.468, lng: -73.15 },
    elevation: 100,
    weather: {
      temperature: 41,
      temperatureUnit: 'F',
      description: 'Cloudy',
      windSpeed: '12 mph',
      windDirection: 'NW',
      humidity: 80,
      dewpoint: 35,
      pressure: 1015,
      timestamp: '2026-10-16T12:00:00Z',
      ...weather,
    },
  };
}

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  mocks.getDb.mockReturnValue(fake.db);
  mocks.getObservationStations.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collectWeatherObservations', () => {
  it('returns 0 when the database is not configured', async () => {
    mocks.getDb.mockReturnValue(null);
    await expect(collectWeatherObservations()).resolves.toBe(0);
    expect(mocks.getObservationStations).not.toHaveBeenCalled();
  });

  it('returns 0 when NOAA returns no stations', async () => {
    mocks.getObservationStations.mockResolvedValue([]);
    await expect(collectWeatherObservations()).resolves.toBe(0);
    expect(fake.queries).toHaveLength(0);
  });

  it('returns 0 when no station has a timestamp', async () => {
    mocks.getObservationStations.mockResolvedValue([station('KBTV', { timestamp: '' })]);
    await expect(collectWeatherObservations()).resolves.toBe(0);
    expect(fake.queries).toHaveLength(0);
  });

  it('maps stations to rows, skipping ones without a timestamp', async () => {
    mocks.getObservationStations.mockResolvedValue([
      station('KBTV'),
      station('KMPV', { timestamp: '' }),
      station('KRUT', {
        windSpeed: 'calm',
        windDirection: null,
        humidity: null,
        pressure: null,
        description: '',
      }),
      station('KMVL', { windSpeed: '7.5 mph', temperature: 0 }),
    ]);

    await expect(collectWeatherObservations()).resolves.toBe(3);

    const [insert] = fake.ofType('insert');
    expect(insert?.table).toBe('weather_observations');
    expect(insert?.onConflictDoNothing).toBe(true);
    const rows = insert?.values as NewWeatherObservation[];
    expect(rows.map((r) => r.stationId)).toEqual(['KBTV', 'KRUT', 'KMVL']);
    expect(rows[0]).toEqual({
      stationId: 'KBTV',
      stationName: 'Station KBTV',
      latitude: '44.468',
      longitude: '-73.15',
      observedAt: new Date('2026-10-16T12:00:00Z'),
      temperatureF: '41',
      humidity: '80',
      windSpeedMph: '12',
      windDirection: 'NW',
      pressureMb: 1015,
      description: 'Cloudy',
    });
    expect(rows[1]).toMatchObject({
      windSpeedMph: null, // "calm" has no number
      windDirection: null,
      humidity: null,
      pressureMb: null,
      description: null,
    });
    expect(rows[2]).toMatchObject({ windSpeedMph: '7.5', temperatureF: '0' });
  });

  it('rethrows service and database failures', async () => {
    mocks.getObservationStations.mockRejectedValueOnce(new Error('NOAA down'));
    await expect(collectWeatherObservations()).rejects.toThrow('NOAA down');

    mocks.getObservationStations.mockResolvedValue([station('KBTV')]);
    fake.failNext('insert', new Error('disk full'));
    await expect(collectWeatherObservations()).rejects.toThrow('disk full');
  });
});
