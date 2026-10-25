/**
 * Data factories for component tests. Each returns a valid record; pass
 * overrides to tweak fields (e.g. inject XSS_PAYLOAD into string fields).
 */
import type { TravelIncident } from '../../services/travelApi';
import type { VT511ParsedIncident } from '../../services/vt511Api';
import type { SkiResort } from '../../services/skiApi';
import type { CreemeeStand } from '../../services/creemeeApi';
import type { RecreationSite } from '../../services/recreationApi';
import type { BackcountrySite } from '../../services/backcountryApi';
import type { CampingArea } from '../../services/campingApi';
import type { Beach } from '../../services/beachApi';
import type { RadarFrameData } from '../../hooks/useRadarAnimation';
import type { RoadWeatherStation } from '../../services/roadWeatherApi';
import type { AlertFeature, ObservationStation } from '../../types';
import type { DarkSkySite } from '../../types/stargazing';

/** Copy of `obj` without the given (optional) keys. */
export function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): T {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy;
}

export function makeVT511Incident(overrides: Partial<VT511ParsedIncident> = {}): TravelIncident {
  return {
    id: 'vt511-1',
    type: 'ACCIDENT',
    title: 'Crash on I-89',
    description: 'Two vehicles, right lane blocked',
    location: { lat: 44.3, lng: -72.6 },
    geometry: null,
    severity: 'MAJOR',
    startTime: '2026-10-16T12:00:00Z',
    endTime: null,
    source: 'VT 511',
    roadName: 'I-89 N',
    affectedLanes: null,
    ...overrides,
  };
}

export function makeStation(overrides: Partial<ObservationStation> = {}): ObservationStation {
  return {
    id: 'KMPV',
    name: 'Barre-Montpelier Airport',
    location: { lat: 44.2, lng: -72.56 },
    elevation: 1165,
    weather: {
      temperature: 45,
      temperatureUnit: 'F',
      description: 'Cloudy',
      windSpeed: '10 mph',
      windDirection: 'NW',
      humidity: 70,
      dewpoint: 36,
      pressure: 101325,
      timestamp: '2026-10-16T12:00:00Z',
    },
    ...overrides,
  };
}

export function makeSkiResort(overrides: Partial<SkiResort> = {}): SkiResort {
  return {
    id: 'stowe',
    name: 'Stowe',
    latitude: 44.53,
    longitude: -72.78,
    logoUrl: null,
    snowfall24hr: 4,
    snowfallCumulative: 40,
    liftsOpen: 8,
    liftsTotal: 12,
    trailsOpen: 80,
    trailsTotal: 116,
    tempCurrent: 22,
    tempHigh: 28,
    tempLow: 15,
    baseDepth: 30,
    lastUpdated: '2026-10-16T12:00:00Z',
    status: 'open',
    color: 'green',
    ...overrides,
  };
}

export function makeCreemeeStand(overrides: Partial<CreemeeStand> = {}): CreemeeStand {
  return {
    id: 'c1',
    name: 'Canteen Creemee',
    town: 'Waitsfield',
    latitude: 44.19,
    longitude: -72.82,
    description: 'Maple creemees',
    specialties: ['Maple'],
    featured: true,
    ...overrides,
  };
}

export function makeRecreationSite(overrides: Partial<RecreationSite> = {}): RecreationSite {
  return {
    id: 'r1',
    name: 'Little River State Park',
    type: 'camping',
    latitude: 44.39,
    longitude: -72.77,
    address: '3444 Little River Rd',
    town: 'Waterbury',
    phone: '802-244-7103',
    contact: null,
    organization: 'VT FPR',
    isPublic: true,
    acreage: 12000,
    parkingSpaces: 50,
    amenities: {
      camping: {
        tentSites: 80,
        rvSites: 20,
        shelters: 20,
        hookups: { electric: 0, water: 0, both: 0 },
        groupCamping: true,
        primitiveCamping: false,
        winterCamping: false,
      },
      swimming: {
        lakeSwimming: true,
        poolSwimming: false,
        riverSwimming: false,
        hasBeach: true,
        waterBodyName: 'Waterbury Reservoir',
      },
      boatRental: true,
      picnicArea: true,
      playground: false,
    },
    ...overrides,
  };
}

export function makeBackcountrySite(overrides: Partial<BackcountrySite> = {}): BackcountrySite {
  return {
    id: 'b1',
    siteId: 'GMSF-12',
    siteType: 'Lean-to',
    latitude: 44.1,
    longitude: -72.9,
    isAccessible: false,
    hasFirePit: true,
    hasPicnicTable: false,
    notes: 'Near the brook',
    parkId: 1,
    districtId: 2,
    ...overrides,
  };
}

export function makeCampingArea(overrides: Partial<CampingArea> = {}): CampingArea {
  return {
    id: 'a1',
    name: 'Groton State Forest',
    type: 'state_forest',
    siteCount: 3,
    sites: [],
    centroid: { latitude: 44.28, longitude: -72.27 },
    boundary: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-72.3, 44.2],
            [-72.2, 44.2],
            [-72.2, 44.3],
            [-72.3, 44.2],
          ],
        ],
      ],
    },
    ...overrides,
  };
}

export function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'beach1',
    name: 'North Beach',
    town: 'Burlington',
    latitude: 44.49,
    longitude: -73.23,
    parkType: 'city',
    amenities: ['parking', 'restrooms'],
    waterQualityGrade: 'A',
    waterTemp: 68,
    eColiLevel: 12,
    cyanobacteriaCategory: null,
    lastTested: '2026-07-01T12:00:00Z',
    advisory: null,
    status: 'open',
    color: 'green',
    lastUpdated: '2026-07-01T12:00:00Z',
    ...overrides,
  };
}

export function makeDarkSkySite(overrides: Partial<DarkSkySite> = {}): DarkSkySite {
  return {
    id: 'site1',
    name: 'Victory Basin',
    coordinates: [-71.8, 44.5],
    bortleClass: 2,
    facilities: { parking: true, camping: true, restrooms: false },
    accessibility: 'easy',
    description: 'Remote bog with open horizons',
    viewingNotes: 'Bring bug spray',
    bestFor: ['milky-way'],
    landType: 'state-forest',
    ...overrides,
  };
}

export function makeRadarFrames(count = 3): RadarFrameData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.UTC(2026, 9, 16, 12, i * 10)).toISOString(),
    timestamp: 1_792_000_000 + i * 600,
    path: `/v2/radar/${i}`,
    tileUrl: `https://tilecache.rainviewer.com/v2/radar/${i}/256/{z}/{x}/{y}/2/1_1.png`,
  }));
}

export function makeAlertFeature(
  overrides: Partial<AlertFeature['properties']> = {},
): AlertFeature {
  return {
    type: 'Feature',
    geometry: null,
    properties: {
      id: 'alert-1',
      event: 'Winter Storm Warning',
      headline: 'Winter Storm Warning until 6 PM',
      severity: 'Severe',
      areaDesc: 'Washington; Lamoille',
      description: 'Heavy snow expected.',
      instruction: 'Avoid travel.',
      effective: '2026-10-16T12:00:00Z',
      expires: '2026-10-17T00:00:00Z',
      ...overrides,
    },
  };
}

export function makeRoadWeatherStation(
  overrides: Partial<RoadWeatherStation> = {},
): RoadWeatherStation {
  return {
    id: '124',
    name: 'I-89 BERLIN',
    lat: 44.21,
    lng: -72.58,
    roadway: 'I-89',
    direction: 'South',
    location: 'BERLIN .2 MILES SOUTH OF EXIT 7',
    surface: 'Wet',
    pavementTempC: -1,
    airTempC: 0.5,
    dewPointC: -2,
    friction: 0.55,
    precip: null,
    observedAt: '2026-10-16T12:00:00Z',
    ...overrides,
  };
}
