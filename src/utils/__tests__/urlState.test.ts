import { describe, expect, it } from 'vitest';
import { buildUrlHash, parseUrlState } from '../urlState';

describe('parseUrlState', () => {
  it('parses view, layers and a station selection', () => {
    const state = parseUrlState('#map=9.25/44.2601/-72.5754&layers=stations,ski&sel=station:KBTV');
    expect(state.view).toEqual({ zoom: 9.25, lat: 44.2601, lng: -72.5754 });
    expect([...(state.layers ?? [])]).toEqual(['weatherStations', 'skiResorts']);
    expect(state.selection).toEqual({ type: 'station', id: 'KBTV' });
  });

  it('parses alert and point selections', () => {
    expect(parseUrlState('#sel=alert:urn:oid:2.49.0.1.840.0.abc').selection).toEqual({
      type: 'alert',
      id: 'urn:oid:2.49.0.1.840.0.abc',
    });
    expect(parseUrlState('#sel=pt:44.48,-73.21').selection).toEqual({
      type: 'location',
      lat: 44.48,
      lng: -73.21,
    });
  });

  it('round-trips point-of-interest selections (VTL-64)', () => {
    const hash = buildUrlHash({
      view: { zoom: 12, lat: 44.53, lng: -72.78 },
      layers: new Set(['skiResorts']),
      selection: { type: 'poi', kind: 'ski', id: 'stowe' },
    });
    expect(hash).toBe('#map=12/44.53/-72.78&layers=ski&sel=ski:stowe');
    expect(parseUrlState(hash).selection).toEqual({ type: 'poi', kind: 'ski', id: 'stowe' });

    const park = buildUrlHash({
      view: { zoom: 10, lat: 44.3, lng: -72.3 },
      layers: new Set(['campingSites']),
      selection: { type: 'poi', kind: 'park', id: 'Groton & Co (VT)' },
    });
    expect(park).toBe('#map=10/44.3/-72.3&layers=camping&sel=park:Groton%20%26%20Co%20(VT)');
    expect(parseUrlState(park).selection).toEqual({
      type: 'poi',
      kind: 'park',
      id: 'Groton & Co (VT)',
    });
  });

  it('ignores unknown point-of-interest kinds and unsafe ids', () => {
    expect(parseUrlState('#sel=volcano:etna').selection).toBeUndefined();
    expect(parseUrlState('#sel=beach:<img>').selection).toBeUndefined();
    expect(
      buildUrlHash({
        view: { zoom: 10, lat: 44.3, lng: -72.3 },
        layers: new Set(),
        selection: { type: 'poi', kind: 'beach', id: '<img>' },
      }),
    ).not.toContain('sel=');
  });

  it('round-trips the road weather layer and a station selection', () => {
    const hash = buildUrlHash({
      view: { zoom: 10, lat: 44.21, lng: -72.58 },
      layers: new Set(['roadWeather']),
      selection: { type: 'roadwx', id: '124' },
    });
    expect(hash).toBe('#map=10/44.21/-72.58&layers=roadwx&sel=roadwx:124');
    expect(parseUrlState(hash).selection).toEqual({ type: 'roadwx', id: '124' });
    expect(parseUrlState(hash).layers).toEqual(new Set(['roadWeather']));
  });

  it('round-trips the seasonal roads layer and a road selection', () => {
    const hash = buildUrlHash({
      view: { zoom: 11, lat: 44.56, lng: -72.79 },
      layers: new Set(['seasonalRoads']),
      selection: { type: 'road', id: 'smugglers-notch' },
    });
    expect(hash).toBe('#map=11/44.56/-72.79&layers=seasonal&sel=road:smugglers-notch');
    expect(parseUrlState(hash)).toEqual({
      view: { zoom: 11, lat: 44.56, lng: -72.79 },
      layers: new Set(['seasonalRoads']),
      selection: { type: 'road', id: 'smugglers-notch' },
    });
    expect(parseUrlState('#sel=road:<x>').selection).toBeUndefined();
  });

  it('round-trips camera layers and camera selections with spaces and &', () => {
    const hash = buildUrlHash({
      view: { zoom: 12, lat: 44.21, lng: -72.58 },
      layers: new Set(['trafficCameras'] as const),
      selection: { type: 'camera', id: 'VT-108 A & B' },
    });
    expect(hash).toBe('#map=12/44.21/-72.58&layers=cameras&sel=camera:VT-108%20A%20%26%20B');
    expect(parseUrlState(hash).selection).toEqual({ type: 'camera', id: 'VT-108 A & B' });
    expect(parseUrlState('#sel=camera:<img>').selection).toBeUndefined();
  });

  it('treats an empty layers list as "all off" and ignores unknown keys', () => {
    expect(parseUrlState('#layers=').layers?.size).toBe(0);
    expect([...(parseUrlState('#layers=bogus,beaches').layers ?? [])]).toEqual(['beachSites']);
    // Inherited object keys are not layer keys
    expect([...(parseUrlState('#layers=constructor,toString,__proto__').layers ?? [])]).toEqual([]);
  });

  it('leaves layers undefined when not specified', () => {
    expect(parseUrlState('#map=8/44/-72.5').layers).toBeUndefined();
  });

  it('ignores out-of-range or malformed values instead of throwing', () => {
    expect(parseUrlState('#map=30/44/-72').view).toBeUndefined(); // zoom
    expect(parseUrlState('#map=8/10/-72').view).toBeUndefined(); // lat outside bounds
    expect(parseUrlState('#map=8/44').view).toBeUndefined();
    expect(parseUrlState('#map=abc/def/ghi').view).toBeUndefined();
    expect(parseUrlState('#sel=pt:0,0').selection).toBeUndefined();
    expect(parseUrlState('#sel=station:<script>').selection).toBeUndefined();
    expect(parseUrlState('#sel=nope:1').selection).toBeUndefined();
    expect(parseUrlState('').view).toBeUndefined();
  });
});

describe('buildUrlHash', () => {
  it('round-trips through parseUrlState', () => {
    const hash = buildUrlHash({
      view: { zoom: 10.123456, lat: 44.260123456, lng: -72.575412345 },
      layers: new Set(['weatherStations', 'trafficFlow', 'beachSites'] as const),
      selection: { type: 'station', id: 'KMPV' },
    });
    expect(hash).toBe(
      '#map=10.12/44.2601/-72.5754&layers=stations,traffic,beaches&sel=station:KMPV',
    );
    expect(parseUrlState(hash)).toEqual({
      view: { zoom: 10.12, lat: 44.2601, lng: -72.5754 },
      layers: new Set(['weatherStations', 'trafficFlow', 'beachSites']),
      selection: { type: 'station', id: 'KMPV' },
    });
  });

  it('writes an empty layers list and point selections', () => {
    expect(
      buildUrlHash({
        view: { zoom: 8, lat: 44, lng: -72.5 },
        layers: new Set(),
        selection: { type: 'location', lat: 44.123456, lng: -72.654321 },
      }),
    ).toBe('#map=8/44/-72.5&layers=&sel=pt:44.12346,-72.65432');
  });
});
