import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { createFireDangerService, labelPoint, parseFireDanger } from '../fireDanger.js';

const SERVICE =
  'https://services5.arcgis.com/Uzks6LSde6r23wwG/arcgis/rest/services/Vermont_Fire_Danger_-_Public/FeatureServer/1/query';
const dangerJson = loadJson<Record<string, unknown>>('anr/fire-danger.geojson');

describe('parseFireDanger (VTL-81)', () => {
  const danger = parseFireDanger(dangerJson);

  it('reads the five rating areas and the statewide record', () => {
    expect(danger.areas.map((a) => [a.id, a.name, a.rating])).toEqual([
      ['1', 'Southern valleys', 3],
      ['2', 'Southern Green Mountains', 3],
      ['3', 'Champlain Valley', 4],
      ['4', 'Central Vermont', 3],
      ['5', 'Northeast Kingdom', 3],
    ]);
    expect(danger.notes).toBe(
      'Dry conditions and an abundance of cured grasses and leaf litter will cause fires to easily escape control. Open burning is not advised.',
    );
    expect(danger.preparedness).toBe(3);
    // The statewide record's edit, the newest
    expect(danger.updatedAt).toBe(new Date(1793123788427).toISOString());
  });

  it('puts each marker inside its own area', () => {
    const [one, two] = danger.areas;
    // Area 1 is two pieces either side of area 2: its centroid would fall in area 2
    expect(Math.abs(one!.labelLng - two!.labelLng)).toBeGreaterThan(0.2);
    const bounds = { 3: [-73.44, -72.66, 43.67, 45.02], 5: [-72.75, -71.47, 44.35, 45.02] };
    for (const [id, [x0, x1, y0, y1]] of Object.entries(bounds)) {
      const a = danger.areas.find((x) => x.id === id)!;
      expect(a.labelLng).toBeGreaterThan(x0!);
      expect(a.labelLng).toBeLessThan(x1!);
      expect(a.labelLat).toBeGreaterThan(y0!);
      expect(a.labelLat).toBeLessThan(y1!);
    }
  });

  it('finds an interior point of a concave polygon', () => {
    // A U shape: the bounding-box center (2, 2) is outside it
    const u = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [3, 4],
          [3, 1],
          [1, 1],
          [1, 4],
          [0, 4],
          [0, 0],
        ] as [number, number][],
      ],
    };
    const [x, y] = labelPoint(u)!;
    expect(x < 1 || x > 3 || y < 1).toBe(true);
  });

  it('treats "None" notes and missing ratings as empty', () => {
    const parsed = parseFireDanger({
      features: [
        {
          properties: { FDRA: 6, NOTES: 'None', EditDate: null, preparedness: null },
          geometry: null,
        },
      ],
    });
    expect(parsed).toEqual({ areas: [], notes: null, preparedness: null, updatedAt: null });
    expect(parseFireDanger(null).areas).toEqual([]);
  });
});

describe('createFireDangerService', () => {
  it('asks for simplified WGS84 GeoJSON and rejects an ArcGIS error body', async () => {
    let url: URL | undefined;
    server.use(
      http.get(SERVICE, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(dangerJson);
      }),
    );
    expect((await createFireDangerService().get()).areas).toHaveLength(5);
    expect(url!.searchParams.get('f')).toBe('geojson');
    expect(url!.searchParams.get('outSR')).toBe('4326');

    server.use(
      http.get(SERVICE, () => HttpResponse.json({ error: { message: 'Token Required' } })),
    );
    await expect(createFireDangerService().get()).rejects.toThrow('Token Required');
  });
});
