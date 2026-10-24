#!/usr/bin/env node
/**
 * Regenerate src/data/seasonalRoads.ts (VTL-55) from VCGI's
 * "Roads - Public (VTrans)" centerlines.
 *
 *   node scripts/build-seasonal-roads.mjs
 *
 * Needs network access to maps.vcgi.vermont.gov. Each road below is selected by
 * a VCGI query (name/route, town code, surface) and an optional bounding box.
 * The extents are approximate: gates sit near where plowing ends, and VCGI has
 * no "seasonal" flag, so the selection follows the unplowed section as closely
 * as the centerline attributes allow.
 */
import { writeFileSync } from 'node:fs';

const SERVICE =
  'https://maps.vcgi.vermont.gov/arcgis/rest/services/VCGI_services/VCGI_BASEMAP_WM_v2/MapServer/16';

/**
 * season: typical closure window as MM-DD (inclusive, wraps over New Year).
 * Real dates depend on weather and the road's owner, so the UI says "typically".
 */
const ROADS = [
  {
    id: 'smugglers-notch',
    name: "Smugglers' Notch (VT-108)",
    between: 'Stowe and Jeffersonville',
    owner: 'VTrans',
    season: { start: '11-15', end: '05-25' },
    seasonText: 'mid-November to late May',
    note: 'Gated for winter between Stowe Mountain Resort and Smugglers’ Notch Resort. Tractor-trailers are banned year-round.',
    sources: [
      {
        label: 'Vermont Public (2023)',
        url: 'https://www.vermontpublic.org/local-news/2023-11-15/smugglers-notch-road-officially-closed-for-winter-season',
      },
      { label: 'WCAX', url: 'https://www.wcax.com/2021/11/24/notch-road-closed-winter' },
    ],
    where: "RTNAME='VT-108'",
    bbox: [-72.82, 44.5425, -72.76, 44.5805],
  },
  {
    id: 'lincoln-gap',
    name: 'Lincoln Gap Road',
    between: 'Lincoln and Warren',
    owner: 'Towns of Lincoln and Warren',
    season: { start: '11-15', end: '05-15' },
    seasonText: 'mid-November to mid-May',
    note: 'Closed to winter traffic over the gap; very steep, and often reopens late in mud season.',
    sources: [
      {
        label: 'U.S. Forest Service',
        url: 'https://www.fs.usda.gov/r09/gmfl/recreation/lincoln-gap-road',
      },
    ],
    where: "PRIMARYNAME='LINCOLN GAP RD'",
  },
  {
    id: 'hazens-notch',
    name: "Hazen's Notch (VT-58)",
    between: 'Montgomery Center and Lowell',
    owner: 'Towns of Montgomery, Westfield and Lowell',
    season: { start: '11-15', end: '05-15' },
    seasonText: 'mid-November to mid-May',
    note: 'The unpaved section through the notch is not plowed in winter.',
    sources: [
      {
        label: 'Wikipedia: Vermont Route 58',
        url: 'https://en.wikipedia.org/wiki/Vermont_Route_58',
      },
    ],
    // Gravel sections only (SURFACETYPE 2); the paved ends are plowed
    where: "PRIMARYNAME IN ('HAZENS NOTCH RD','HAZEN NOTCH RD') AND SURFACETYPE=2",
  },
  {
    id: 'kelley-stand',
    name: 'Kelley Stand Road',
    between: 'East Arlington and Stratton',
    owner: 'Green Mountain National Forest',
    season: { start: '11-15', end: '05-15' },
    seasonText: 'late fall to mid-May',
    note: 'Unplowed through the national forest in winter; a popular snowmobile route.',
    sources: [
      {
        label: 'U.S. Forest Service scenic drives',
        url: 'https://fs.usda.gov/r09/gmfl/recreation/opportunities/scenic-drives',
      },
    ],
    where: "PRIMARYNAME='KELLEY STAND RD'",
  },
  {
    id: 'danby-mount-tabor',
    name: 'Danby–Mount Tabor Road (FR 10)',
    between: 'Mount Tabor and Landgrove',
    owner: 'Green Mountain National Forest',
    season: { start: '11-15', end: '05-15' },
    seasonText: 'late fall to mid-May',
    note: 'Forest Road 10 is gated in winter.',
    sources: [
      {
        label: 'U.S. Forest Service scenic drives',
        url: 'https://fs.usda.gov/r09/gmfl/recreation/opportunities/scenic-drives',
      },
    ],
    // The forest-road sections; the paved Brooklyn Rd end at Mount Tabor is plowed
    where: "RTNAME='NFR-10' AND SURFACETYPE=2",
  },
  {
    id: 'stowe-toll-road',
    name: 'Stowe Auto Toll Road (Mt. Mansfield)',
    between: 'Stowe Mountain Resort and the Mt. Mansfield summit ridge',
    owner: 'Stowe Mountain Resort',
    season: { start: '10-20', end: '05-25' },
    seasonText: 'mid/late October to late May',
    note: 'Private toll road; becomes a ski trail in winter.',
    sources: [
      {
        label: 'Happy Vermont (2025)',
        url: 'https://happyvermont.com/2025/09/25/vermont-scenic-mountain-drives-closed-in-winter/',
      },
    ],
    where: "PRIMARYNAME='TOLL RD' AND CTCODE='0808'",
  },
  {
    id: 'burke-toll-road',
    name: 'Burke Mountain Toll Road',
    between: 'Burke Mountain base and summit',
    owner: 'Burke Mountain',
    season: { start: '10-20', end: '05-25' },
    seasonText: 'mid/late October to late May',
    note: 'Private toll road to the summit; closed for the ski season.',
    sources: [
      {
        label: 'Happy Vermont (2025)',
        url: 'https://happyvermont.com/2025/09/25/vermont-scenic-mountain-drives-closed-in-winter/',
      },
    ],
    where: "PRIMARYNAME='TOLL RD' AND CTCODE='0302'",
  },
  {
    id: 'mount-ascutney-parkway',
    name: 'Mount Ascutney Parkway',
    between: 'Mount Ascutney State Park entrance and the summit lot',
    owner: 'Vermont State Parks',
    season: { start: '10-20', end: '05-25' },
    seasonText: 'mid/late October to late May',
    note: 'State park road; the gate closes for the season.',
    sources: [
      {
        label: 'Happy Vermont (2025)',
        url: 'https://happyvermont.com/2025/09/25/vermont-scenic-mountain-drives-closed-in-winter/',
      },
    ],
    where: "PRIMARYNAME='MOUNT ASCUTNEY STATE PARK RD'",
  },
];

const round = (n) => Math.round(n * 1e5) / 1e5;

async function query(road) {
  const params = new URLSearchParams({
    where: road.where,
    outFields: 'OBJECTID',
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: '0.00004', // ~4 m
    f: 'json',
  });
  if (road.bbox) {
    params.set('geometry', road.bbox.join(','));
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }
  const res = await fetch(`${SERVICE}/query?${params}`);
  if (!res.ok) throw new Error(`${road.id}: VCGI query failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`${road.id}: ${JSON.stringify(data.error)}`);
  if (data.exceededTransferLimit) throw new Error(`${road.id}: result truncated`);
  const features = (data.features ?? []).sort(
    (a, b) => a.attributes.OBJECTID - b.attributes.OBJECTID,
  );
  if (features.length === 0) throw new Error(`${road.id}: no segments matched`);
  const [w, s, e, n] = road.bbox ?? [-Infinity, -Infinity, Infinity, Infinity];
  const lines = [];
  for (const f of features) {
    for (const path of f.geometry.paths) {
      // Clip to the bbox by dropping vertices outside it (segments only poke
      // slightly past the box edges, so this is enough)
      const pts = path
        .filter(([x, y]) => x >= w && x <= e && y >= s && y <= n)
        .map(([x, y]) => [round(x), round(y)]);
      if (pts.length >= 2) lines.push(pts);
    }
  }
  return lines;
}

const out = [];
for (const road of ROADS) {
  const lines = await query(road);
  const { where: _w, bbox: _b, ...meta } = road;
  out.push({ ...meta, lines });
  console.log(`${road.id}: ${lines.length} lines, ${lines.flat().length} points`);
}

const body = `/**
 * Seasonally closed roads: notches, gaps and mountain toll roads (VTL-55).
 *
 * GENERATED by scripts/build-seasonal-roads.mjs from VCGI "Roads - Public
 * (VTrans)" centerlines (${SERVICE}).
 * Do not edit by hand; edit the list in the script and re-run it.
 *
 * Extents are approximate and closure dates vary by year; the UI says so.
 */

export interface SeasonalRoadSource {
  label: string;
  url: string;
}

export interface SeasonalRoad {
  id: string;
  name: string;
  between: string;
  owner: string;
  /** Typical closure window, MM-DD inclusive; may wrap over New Year. */
  season: { start: string; end: string };
  seasonText: string;
  note: string;
  sources: SeasonalRoadSource[];
  /** [lng, lat] polylines */
  lines: [number, number][][];
}

export const SEASONAL_ROADS: SeasonalRoad[] = ${JSON.stringify(out)};
`;
writeFileSync(new URL('../src/data/seasonalRoads.ts', import.meta.url), body);
console.log('Wrote src/data/seasonalRoads.ts');
