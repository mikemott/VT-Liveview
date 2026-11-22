import { describe, expect, it } from 'vitest';
import { groupCameraSites, siteViewsFor, viewDirection } from '../cameraSites';
import type { TrafficCamera } from '../../services/cameraApi';

const cam = (over: Partial<TrafficCamera> & Pick<TrafficCamera, 'id'>): TrafficCamera => ({
  name: over.id,
  lat: 44.3,
  lng: -72.9,
  roadway: 'I-89',
  direction: null,
  online: true,
  ...over,
});

// Real layouts from the VTrans feed (Nov 2026)
const BOLTON_SOUTH = cam({
  id: 'BOLTON RWIS CCTV',
  name: 'BOLTON I-89 South',
  lat: 44.373_51,
  lng: -72.876_9,
  direction: 'South',
});
const BOLTON_NORTH = cam({
  id: 'BOLTON RWIS CCTV RT2',
  name: 'BOLTON I-89 SB RT2 North',
  lat: 44.373_8, // ~44 m away
  lng: -72.876_5,
  direction: 'North',
});
const EXIT_14 = [3, 1, 4, 2].map((n) =>
  cam({
    id: `I-89 South Burlington Exit-14 CCTV-${n}`,
    lat: 44.4697,
    lng: -73.1795,
    direction: 'North', // the feed says North for all four
    online: n !== 1,
  }),
);
const BERLIN = cam({
  id: 'I-89 SB BERLIN',
  name: 'BERLIN I-89 South',
  lat: 44.2123,
  lng: -72.5834,
});

describe('camera sites (VTL-99)', () => {
  it('reads the direction from the end of the name before the feed field', () => {
    expect(viewDirection(BOLTON_NORTH)).toBe('North');
    expect(viewDirection(cam({ id: 'x', name: 'Alburgh CCTV', direction: 'East' }))).toBe('East');
    expect(viewDirection(EXIT_14[0]!)).toBe('North');
    expect(viewDirection(cam({ id: 'y', name: 'Somewhere' }))).toBeNull();
  });

  it('groups views close together into one site and leaves lone cameras alone', () => {
    const sites = groupCameraSites([BOLTON_SOUTH, BERLIN, BOLTON_NORTH]);
    expect(sites).toHaveLength(2);
    const bolton = sites[0]!;
    expect(bolton.views.map((v) => [v.label, v.camera.id])).toEqual([
      ['North', 'BOLTON RWIS CCTV RT2'],
      ['South', 'BOLTON RWIS CCTV'],
    ]);
    expect(sites[1]!.views).toHaveLength(1);
    expect(sites[1]!.primary).toBe(BERLIN);
  });

  it('does not group cameras more than 100 m apart', () => {
    const far = cam({ ...BOLTON_NORTH, id: 'far', lat: BOLTON_SOUTH.lat + 0.0012 }); // ~130 m
    expect(groupCameraSites([BOLTON_SOUTH, far])).toHaveLength(2);
  });

  it('numbers views when directions are missing or repeat, in the feed order', () => {
    const [site] = groupCameraSites(EXIT_14);
    expect(site!.views.map((v) => [v.label, v.camera.id.slice(-6)])).toEqual([
      ['View 1', 'CCTV-1'],
      ['View 2', 'CCTV-2'],
      ['View 3', 'CCTV-3'],
      ['View 4', 'CCTV-4'],
    ]);
  });

  it("opens a site's first online view from the marker", () => {
    const [site] = groupCameraSites(EXIT_14);
    expect(site!.primary.id).toBe('I-89 South Burlington Exit-14 CCTV-2');
    const allOffline = EXIT_14.map((c) => ({ ...c, online: false }));
    expect(groupCameraSites(allOffline)[0]!.primary.id).toBe(
      'I-89 South Burlington Exit-14 CCTV-1',
    );
  });

  it('lists the other views for a camera, or none for a single-view camera', () => {
    const all = [BOLTON_SOUTH, BERLIN, BOLTON_NORTH];
    expect(siteViewsFor(BOLTON_SOUTH, all).map((v) => v.label)).toEqual(['North', 'South']);
    expect(siteViewsFor(BERLIN, all)).toEqual([]);
  });
});
