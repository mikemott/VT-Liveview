import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw.js';
import { createFakeDb, type FakeDb } from '../../db/__tests__/fakeDb.js';
import type { NewTrafficIncident } from '../../db/schema.js';

const dbMock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('../../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/index.js')>()),
  getDb: dbMock.getDb,
}));

const { collectTrafficIncidents } = await import('../traffic.js');

const VT511_URL = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const fixtureXml = readFileSync(
  fileURLToPath(new URL('../../__fixtures__/collectors/vt511-incidents.xml', import.meta.url)),
  'utf-8',
);

function serveXml(xml: string, status = 200): void {
  server.use(
    http.get(VT511_URL, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('dataTypes') !== 'incidentData') {
        return HttpResponse.text('wrong dataTypes', { status: 400 });
      }
      return HttpResponse.text(xml, { status, headers: { 'Content-Type': 'text/xml' } });
    }),
  );
}

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  dbMock.getDb.mockReturnValue(fake.db);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collectTrafficIncidents', () => {
  it('returns 0 without touching the network when the database is not configured', async () => {
    dbMock.getDb.mockReturnValue(null);
    // No MSW handler registered: any fetch would fail the test via onUnhandledRequest
    await expect(collectTrafficIncidents()).resolves.toBe(0);
  });

  it('parses, dedupes and inserts new incidents, skipping ones without a location', async () => {
    serveXml(fixtureXml);

    await collectTrafficIncidents();

    const [existingLookup] = fake.ofType('select');
    expect(existingLookup?.table).toBe('traffic_incidents');
    expect(existingLookup?.where?.params).toEqual(['vt511-INC-1', 'vt511-INC-2', 'vt511-INC-3']);

    const inserts = fake.ofType('insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.onConflictDoNothing).toBe(true);
    const rows = inserts[0]?.values as NewTrafficIncident[];
    expect(rows.map((r) => r.sourceId)).toEqual(['vt511-INC-1', 'vt511-INC-2', 'vt511-INC-3']);

    expect(rows[0]).toMatchObject({
      incidentType: 'ACCIDENT',
      severity: 'MAJOR',
      title: 'Crash on I-89 northbound',
      description: 'Two vehicles, right lane blocked',
      latitude: '44.475',
      longitude: '-73.212',
      roadName: 'I-89',
      affectedLanes: 'Right lane',
      startedAt: new Date('2026-10-16T12:00:00Z'),
      source: 'VT 511',
    });
    expect(rows[1]).toMatchObject({
      incidentType: 'CONSTRUCTION',
      severity: 'MINOR',
      title: 'Paving',
      roadName: 'US-2',
      startedAt: null, // invalid date string is dropped
    });
    expect(rows[2]).toMatchObject({
      incidentType: 'CLOSURE',
      severity: 'MODERATE',
      title: 'Traffic Incident',
      description: '',
      roadName: null,
    });
  });

  it('touches lastSeenAt for known incidents and only inserts the new ones', async () => {
    serveXml(fixtureXml);
    fake.queueSelect([{ sourceId: 'vt511-INC-1' }, { sourceId: 'vt511-INC-3' }]);

    await collectTrafficIncidents();

    const [touch, resolve] = fake.ofType('update');
    expect(touch?.set).toEqual({ lastSeenAt: expect.any(Date) as Date });
    expect(touch?.where?.params).toEqual(['vt511-INC-1', 'vt511-INC-3']);

    const rows = fake.ofType('insert')[0]?.values as NewTrafficIncident[];
    expect(rows.map((r) => r.sourceId)).toEqual(['vt511-INC-2']);

    // Anything open that is not in the current feed is resolved
    expect(resolve?.set).toEqual({ resolvedAt: expect.any(Date) as Date });
    expect(resolve?.where?.sql).toContain('"resolved_at" is null');
    expect(resolve?.where?.sql).toContain('not in');
    expect(resolve?.where?.params).toEqual(['vt511-INC-1', 'vt511-INC-2', 'vt511-INC-3']);
  });

  it('skips the insert when every incident already exists', async () => {
    serveXml(fixtureXml);
    fake.queueSelect([
      { sourceId: 'vt511-INC-1' },
      { sourceId: 'vt511-INC-2' },
      { sourceId: 'vt511-INC-3' },
    ]);

    await collectTrafficIncidents();

    expect(fake.ofType('insert')).toHaveLength(0);
    expect(fake.ofType('update')).toHaveLength(2);
  });

  it('returns the number of incidents in the feed', async () => {
    serveXml(
      '<r><incident><id>A</id><lat>44000000</lat><lon>-72000000</lon></incident>' +
        '<incident><id>B</id><lat>44100000</lat><lon>-72100000</lon></incident></r>',
    );
    await expect(collectTrafficIncidents()).resolves.toBe(2);
  });

  it('resolves every open incident when the feed is empty (FINDINGS Low traffic.ts:58)', async () => {
    serveXml('<incidentData></incidentData>');

    await expect(collectTrafficIncidents()).resolves.toBe(0);

    expect(fake.ofType('insert')).toHaveLength(0);
    const updates = fake.ofType('update');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.table).toBe('traffic_incidents');
    expect(updates[0]?.set).toEqual({ resolvedAt: expect.any(Date) as Date });
    expect(updates[0]?.where).toEqual({
      sql: '"traffic_incidents"."resolved_at" is null',
      params: [],
    });
  });

  it('throws on a non-2xx upstream and does not resolve anything', async () => {
    serveXml('upstream down', 502);

    await expect(collectTrafficIncidents()).rejects.toThrow('VT 511 API returned 502');
    expect(fake.queries).toHaveLength(0);
  });

  it('propagates database errors', async () => {
    serveXml(fixtureXml);
    fake.failNext('insert', new Error('insert failed'));

    await expect(collectTrafficIncidents()).rejects.toThrow('insert failed');
  });

  it.todo(
    'uses a deterministic id for incidents without <id> instead of Date.now()+random (FINDINGS Low traffic.ts:167)',
  );
  it.todo('aborts the VT 511 fetch after a timeout (FINDINGS H5)');
});
