import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from '../../db/__tests__/fakeDb.js';
import type { NewWeatherAlert } from '../../db/schema.js';
import type { MergedAlert } from '../../types/index.js';

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getMergedAlerts: vi.fn() }));
vi.mock('../../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/index.js')>()),
  getDb: mocks.getDb,
}));
vi.mock('../../services/noaa.js', () => ({ getMergedAlerts: mocks.getMergedAlerts }));

const { collectWeatherAlerts } = await import('../alerts.js');

function mergedAlert(id: string, overrides: Partial<MergedAlert> = {}): MergedAlert {
  return {
    id,
    event: 'Winter Storm Warning',
    headline: 'Winter Storm Warning until Friday',
    severity: 'Severe',
    certainty: 'Likely',
    urgency: 'Expected',
    description: 'Heavy snow expected.',
    instruction: 'Avoid travel.',
    areaDesc: 'Lamoille; Orleans',
    effective: '2026-10-16T10:00:00Z',
    expires: '2026-10-17T10:00:00Z',
    geometry: { type: 'MultiPolygon', coordinates: [[[[-72.5, 44.5]]]] },
    mergedFrom: [`${id}-a`],
    affectedZoneIds: ['VTZ006', 'VTZ007'],
    ...overrides,
  };
}

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  mocks.getDb.mockReturnValue(fake.db);
  mocks.getMergedAlerts.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collectWeatherAlerts', () => {
  it('returns 0 and does not call NOAA when the database is not configured', async () => {
    mocks.getDb.mockReturnValue(null);
    await expect(collectWeatherAlerts()).resolves.toBe(0);
    expect(mocks.getMergedAlerts).not.toHaveBeenCalled();
  });

  it('returns 0 without queries when there are no active alerts', async () => {
    mocks.getMergedAlerts.mockResolvedValue([]);
    await expect(collectWeatherAlerts()).resolves.toBe(0);
    expect(mocks.getMergedAlerts).toHaveBeenCalledWith('VT');
    expect(fake.queries).toHaveLength(0);
  });

  it('inserts new alerts (deduped by id) with mapped columns', async () => {
    mocks.getMergedAlerts.mockResolvedValue([
      mergedAlert('a1'),
      mergedAlert('a2', { headline: null, instruction: null, geometry: undefined as never }),
      mergedAlert('a1', { event: 'Duplicate' }),
    ]);

    await collectWeatherAlerts();

    const [lookup] = fake.ofType('select');
    expect(lookup?.table).toBe('weather_alerts');
    expect(lookup?.where?.params).toEqual(['a1', 'a2']);

    expect(fake.ofType('update')).toHaveLength(0);
    const [insert] = fake.ofType('insert');
    expect(insert?.onConflictDoNothing).toBe(true);
    const rows = insert?.values as NewWeatherAlert[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      noaaAlertId: 'a1',
      eventType: 'Winter Storm Warning',
      severity: 'Severe',
      certainty: 'Likely',
      urgency: 'Expected',
      headline: 'Winter Storm Warning until Friday',
      description: 'Heavy snow expected.',
      instruction: 'Avoid travel.',
      areaDesc: 'Lamoille; Orleans',
      affectedZones: ['VTZ006', 'VTZ007'],
      geometry: { type: 'MultiPolygon', coordinates: [[[[-72.5, 44.5]]]] },
      effectiveAt: new Date('2026-10-16T10:00:00Z'),
      expiresAt: new Date('2026-10-17T10:00:00Z'),
    });
    expect(rows[1]).toMatchObject({ noaaAlertId: 'a2', headline: null, instruction: null });
    expect(rows[1]?.geometry).toBeNull();
  });

  it('touches lastSeenAt for known alerts and inserts only unknown ones', async () => {
    mocks.getMergedAlerts.mockResolvedValue([mergedAlert('a1'), mergedAlert('a2')]);
    fake.queueSelect([{ noaaAlertId: 'a1' }]);

    await collectWeatherAlerts();

    const [update] = fake.ofType('update');
    expect(update?.table).toBe('weather_alerts');
    expect(update?.set).toEqual({ lastSeenAt: expect.any(Date) as Date });
    expect(update?.where?.params).toEqual(['a1']);
    const rows = fake.ofType('insert')[0]?.values as NewWeatherAlert[];
    expect(rows.map((r) => r.noaaAlertId)).toEqual(['a2']);
  });

  it('only updates when every alert is already stored', async () => {
    mocks.getMergedAlerts.mockResolvedValue([mergedAlert('a1')]);
    fake.queueSelect([{ noaaAlertId: 'a1' }]);

    await expect(collectWeatherAlerts()).resolves.toBe(1);
    expect(fake.ofType('insert')).toHaveLength(0);
    expect(fake.ofType('update')).toHaveLength(1);
  });

  it('rethrows service failures', async () => {
    mocks.getMergedAlerts.mockRejectedValue(new Error('NOAA down'));
    await expect(collectWeatherAlerts()).rejects.toThrow('NOAA down');
  });

  it('rethrows database failures', async () => {
    mocks.getMergedAlerts.mockResolvedValue([mergedAlert('a1')]);
    fake.failNext('select', new Error('connection reset'));
    await expect(collectWeatherAlerts()).rejects.toThrow('connection reset');
  });

  // FINDINGS H1 (merged ids stable across polls) is fixed in services/noaa.ts and
  // covered by services/__tests__/noaa.api.test.ts.
});
