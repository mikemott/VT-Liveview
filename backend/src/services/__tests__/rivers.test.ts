import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import {
  createRiverService,
  floodCategory,
  isVermontGauge,
  parseGaugeDetail,
  parseGauges,
} from '../rivers.js';

const NWPS = 'https://api.water.noaa.gov/nwps/v1';
const gaugesJson = loadJson<Record<string, unknown>>('nwps/gauges.json');
const gaugeJson = loadJson<Record<string, unknown>>('nwps/gauge-MONV1.json');
const stageflowJson = loadJson<Record<string, unknown>>('nwps/stageflow-MONV1.json');
const NOW = Date.parse('2026-10-28T18:00:00Z');

describe('parseGauges', () => {
  const gauges = parseGauges(gaugesJson);

  it('keeps Vermont gauges and Connecticut River border gauges', () => {
    expect(gauges.map((g) => g.id)).toEqual(['ARLV1', 'BMFV1', 'DLTN3', 'BURV1', 'ESSV1', 'MONV1']);
  });

  it('reads stage, flow (kcfs → cfs) and flood categories', () => {
    expect(gauges.find((g) => g.id === 'MONV1')).toMatchObject({
      name: 'Winooski River at Montpelier',
      stageFt: 3.12,
      flowCfs: 96,
      category: 'no_flooding',
      observedAt: '2026-10-28T17:45:00Z',
      forecastCategory: 'no_flooding',
      forecastStageFt: 3.1,
    });
    expect(gauges.find((g) => g.id === 'ESSV1')).toMatchObject({
      category: 'action',
      forecastCategory: 'minor',
      forecastStageFt: 14.8,
    });
  });

  it('marks gauges without a current reading or forecast', () => {
    expect(gauges.find((g) => g.id === 'ARLV1')).toMatchObject({
      stageFt: null,
      flowCfs: null,
      category: 'unknown',
      observedAt: null,
      forecastCategory: null,
    });
  });

  it('tolerates junk', () => {
    expect(parseGauges(null)).toEqual([]);
    expect(parseGauges({ gauges: [null, { lid: 'X' }, { lid: 'bad id!' }] })).toEqual([]);
  });
});

describe('helpers', () => {
  it('maps NWPS categories', () => {
    expect(floodCategory('moderate')).toBe('moderate');
    expect(floodCategory('obs_not_current')).toBe('unknown');
    expect(floodCategory(undefined)).toBe('unknown');
  });

  it('includes only border gauges on shared waters', () => {
    expect(isVermontGauge('VT', 'Otter Creek at Middlebury')).toBe(true);
    expect(isVermontGauge('NH', 'Connecticut River at Dalton')).toBe(true);
    expect(isVermontGauge('NY', 'Lake Champlain at Rouses Point')).toBe(true);
    expect(isVermontGauge('NH', 'Suncook River near Allenstown')).toBe(false);
  });
});

describe('parseGaugeDetail', () => {
  const detail = parseGaugeDetail(gaugeJson, stageflowJson, NOW)!;

  it('reads flood stages, impacts and the highest crests', () => {
    expect(detail.floodStages).toEqual({ action: 11, minor: 15, moderate: 16, major: 17.5 });
    expect(detail.usgsId).toBe('04286000');
    expect(detail.county).toBe('Washington');
    expect(detail.impacts[0]!.stageFt).toBeGreaterThan(detail.impacts.at(-1)!.stageFt);
    expect(detail.historicCrests).toEqual([
      { date: '1927-11-03', stageFt: 27.1, flowCfs: 57000 },
      { date: '2023-07-11', stageFt: 21.29, flowCfs: 23100 },
      { date: '2011-08-29', stageFt: 19.05, flowCfs: 14239 },
    ]);
  });

  it('keeps the last week of observations, hourly, and the forecast', () => {
    expect(detail.observed.length).toBeGreaterThan(10);
    for (const p of detail.observed)
      expect(NOW - Date.parse(p.t)).toBeLessThanOrEqual(7 * 86400_000);
    const hours = detail.observed.map((p) => Math.floor(Date.parse(p.t) / 3600_000));
    expect(new Set(hours).size).toBe(hours.length);
    expect(detail.forecast).toHaveLength(6);
    expect(detail.forecastIssuedAt).toBe('2026-10-28T15:06:00Z');
  });

  it('copes with a missing hydrograph', () => {
    const bare = parseGaugeDetail(gaugeJson, null, NOW)!;
    expect(bare.observed).toEqual([]);
    expect(bare.forecast).toEqual([]);
    expect(bare.forecastIssuedAt).toBeNull();
    expect(parseGaugeDetail({}, null)).toBeNull();
  });
});

describe('createRiverService', () => {
  it('caches gauge details and falls back to the last good copy', async () => {
    let calls = 0;
    let fail = false;
    server.use(
      http.get(`${NWPS}/gauges/MONV1`, () => {
        calls++;
        return fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(gaugeJson);
      }),
      http.get(`${NWPS}/gauges/MONV1/stageflow`, () => HttpResponse.json(stageflowJson)),
    );
    let t = NOW;
    const svc = createRiverService('test', () => t);
    expect((await svc.getGauge('MONV1'))?.floodStages.minor).toBe(15);
    await svc.getGauge('MONV1');
    expect(calls).toBe(1);
    t += 11 * 60_000;
    fail = true;
    expect((await svc.getGauge('MONV1'))?.floodStages.minor).toBe(15);
    expect(calls).toBe(2);
    // While NWPS is down, the stale copy is served without asking again for 30 s
    t += 10_000;
    await svc.getGauge('MONV1');
    expect(calls).toBe(2);
    t += 25_000;
    await svc.getGauge('MONV1');
    expect(calls).toBe(3);
    expect(await svc.getGauge('../x')).toBeNull();
  });
});
