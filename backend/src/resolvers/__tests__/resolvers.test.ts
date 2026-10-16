/**
 * Resolver tests for every non-historical Query field, executed through the real
 * schema via fastify.inject('/graphql'). Services are mocked, so these exercise
 * argument passing, response shaping and error surfacing only.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Alert,
  ForecastPeriod,
  MergedAlert,
  ObservationStation,
  RadarInfo,
  WeatherConditions,
} from '../../types/index.js';
import type { SkiResort } from '../../types/ski.js';
import type { Beach } from '../../types/beach.js';
import type { BackcountrySite, CampingArea } from '../../types/backcountry.js';
import type { RecreationSite } from '../../types/recreation.js';
import type { CreemeeStand } from '../../services/creemee.js';
import type { HistoricalWeatherData } from '../../services/noaaCDO.js';

const m = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getForecast: vi.fn(),
  getAlerts: vi.fn(),
  getMergedAlerts: vi.fn(),
  getObservationStations: vi.fn(),
  clearStationsCache: vi.fn(),
  getRadarInfo: vi.fn(),
  getHistoricalWeather: vi.fn(),
  fetchSkiConditions: vi.fn(),
  fetchCreemeeStands: vi.fn(),
  fetchFeaturedStands: vi.fn(),
  getCreemeeStandById: vi.fn(),
  getCreemeeStandsByTown: vi.fn(),
  fetchRecreationSites: vi.fn(),
  fetchBackcountrySites: vi.fn(),
  getCampingAreas: vi.fn(),
  fetchBeachWaterQuality: vi.fn(),
}));

vi.mock('../../services/noaa.js', () => ({
  getCurrentWeather: m.getCurrentWeather,
  getForecast: m.getForecast,
  getAlerts: m.getAlerts,
  getMergedAlerts: m.getMergedAlerts,
  getObservationStations: m.getObservationStations,
  clearStationsCache: m.clearStationsCache,
}));
vi.mock('../../services/radar.js', () => ({ getRadarInfo: m.getRadarInfo }));
vi.mock('../../services/noaaCDO.js', () => ({ getHistoricalWeather: m.getHistoricalWeather }));
vi.mock('../../services/skiConditions.js', () => ({ fetchSkiConditions: m.fetchSkiConditions }));
vi.mock('../../services/creemee.js', () => ({
  fetchCreemeeStands: m.fetchCreemeeStands,
  fetchFeaturedStands: m.fetchFeaturedStands,
  getCreemeeStandById: m.getCreemeeStandById,
  getCreemeeStandsByTown: m.getCreemeeStandsByTown,
}));
vi.mock('../../services/recreationSites.js', () => ({
  fetchRecreationSites: m.fetchRecreationSites,
}));
vi.mock('../../services/backcountrySites.js', () => ({
  fetchBackcountrySites: m.fetchBackcountrySites,
}));
vi.mock('../../services/campingAreas.js', () => ({ getCampingAreas: m.getCampingAreas }));
vi.mock('../../services/beachWaterQuality.js', () => ({
  fetchBeachWaterQuality: m.fetchBeachWaterQuality,
}));
vi.mock('../../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/index.js')>()),
  getDb: vi.fn(() => null),
  isDatabaseEnabled: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const conditions: WeatherConditions = {
  temperature: 41,
  temperatureUnit: 'F',
  description: 'Cloudy',
  windSpeed: '10 mph',
  windDirection: 'NW',
  humidity: 72,
  timestamp: '2026-10-16T12:00:00Z',
  stationName: 'Burlington International Airport',
  icon: null,
};

const forecastPeriod: ForecastPeriod = {
  name: 'Tonight',
  temperature: 33,
  temperatureUnit: 'F',
  shortForecast: 'Snow Showers',
  detailedForecast: 'Snow showers after 9pm.',
  startTime: '2026-10-16T18:00:00-04:00',
  endTime: '2026-10-17T06:00:00-04:00',
  isDaytime: false,
  icon: null,
  windSpeed: '5 mph',
  windDirection: 'S',
};

const alert: Alert = {
  id: 'urn:oid:1',
  event: 'Frost Advisory',
  headline: null,
  severity: 'Minor',
  certainty: 'Likely',
  urgency: 'Expected',
  description: 'Frost expected.',
  instruction: null,
  areaDesc: 'Rutland',
  effective: '2026-10-16T20:00:00Z',
  expires: '2026-10-17T12:00:00Z',
  geometry: { type: 'Polygon', coordinates: [[[[-73, 43.6]]]] },
};

const merged: MergedAlert = {
  ...alert,
  id: 'merged-frost-advisory',
  geometry: { type: 'MultiPolygon', coordinates: [[[[-73, 43.6]]]] },
  mergedFrom: ['urn:oid:1', 'urn:oid:2'],
  affectedZoneIds: ['VTZ011'],
};

const radar: RadarInfo = {
  baseUrl: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0',
  timestamps: [{ time: '2026-10-16T12:00:00Z', path: 'nexrad-n0q-900913-m05m' }],
  tilePattern: '{z}/{x}/{y}.png',
};

const station: ObservationStation = {
  id: 'KBTV',
  name: 'Burlington',
  location: { lat: 44.47, lng: -73.15 },
  elevation: 100,
  weather: {
    temperature: 41,
    temperatureUnit: 'F',
    description: 'Cloudy',
    windSpeed: null,
    windDirection: null,
    humidity: null,
    dewpoint: null,
    pressure: 1015,
    timestamp: '2026-10-16T12:00:00Z',
  },
};

const historical: HistoricalWeatherData = {
  weather: [{ date: '2025-10-16', tempMin: 30, tempMax: 50, precipitation: 0.1, snowfall: null }],
  stationName: 'BURLINGTON INTL AP',
  stationDistance: 2.4,
};

const resort: SkiResort = {
  id: 'stowe',
  name: 'Stowe',
  latitude: 44.53,
  longitude: -72.78,
  logoUrl: null,
  snowfall24hr: 4,
  snowfallCumulative: 20,
  liftsOpen: 5,
  liftsTotal: 13,
  trailsOpen: 30,
  trailsTotal: 116,
  tempCurrent: 25,
  tempHigh: 30,
  tempLow: 18,
  baseDepth: 24,
  lastUpdated: '2026-10-16T11:00:00Z',
  status: 'partial',
  color: 'yellow',
};

const stand: CreemeeStand = {
  id: 'c1',
  name: 'Canteen Creemee',
  town: 'Waitsfield',
  latitude: 44.19,
  longitude: -72.82,
  specialties: ['maple'],
  featured: true,
};

const beach: Beach = {
  id: 'north-beach',
  name: 'North Beach',
  town: 'Burlington',
  latitude: 44.49,
  longitude: -73.24,
  parkType: 'city',
  amenities: ['restrooms'],
  waterQualityGrade: 'A',
  waterTemp: 68,
  eColiLevel: 10,
  cyanobacteriaCategory: 1,
  lastTested: '2026-08-01',
  advisory: null,
  status: 'open',
  color: 'green',
  lastUpdated: '2026-08-01T12:00:00Z',
};

const recreationSite: RecreationSite = {
  id: 'r1',
  name: 'Lake Elmore State Park',
  type: 'camping',
  latitude: 44.54,
  longitude: -72.53,
  address: null,
  town: 'Elmore',
  phone: null,
  contact: null,
  organization: 'VT FPR',
  isPublic: true,
  acreage: 709,
  parkingSpaces: null,
  amenities: {
    camping: null,
    swimming: null,
    boatRental: true,
    picnicArea: true,
    playground: false,
  },
};

const site: BackcountrySite = {
  id: 'b1',
  siteId: 'LT-1',
  siteType: 'Lean-to',
  latitude: 44.5,
  longitude: -72.8,
  isAccessible: false,
  hasFirePit: true,
  hasPicnicTable: false,
  notes: null,
  parkId: null,
  districtId: 3,
};

const area: CampingArea = {
  id: 'a1',
  name: 'Mount Mansfield State Forest',
  type: 'state_forest',
  siteCount: 1,
  sites: [site],
  centroid: { latitude: 44.5, longitude: -72.8 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GqlError {
  message: string;
  path?: string[];
  extensions?: { code?: string };
}
interface GqlBody {
  data?: Record<string, unknown> | null;
  errors?: GqlError[];
}

let app: FastifyInstance;

async function gql(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ status: number; body: GqlBody }> {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { 'content-type': 'application/json' },
    payload: { query, ...(variables && { variables }) },
  });
  return { status: res.statusCode, body: res.json<GqlBody>() };
}

beforeAll(async () => {
  const { buildServer } = await import('../../app.js');
  app = await buildServer({ logger: false });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('happy paths', () => {
  it('currentWeather passes lat/lon and returns conditions', async () => {
    m.getCurrentWeather.mockResolvedValue(conditions);
    const { status, body } = await gql(
      `{ currentWeather(lat: 44.47, lon: -73.15) {
          temperature temperatureUnit description windSpeed windDirection humidity
          timestamp stationName icon } }`,
    );
    expect(status).toBe(200);
    expect(body).toEqual({ data: { currentWeather: conditions } });
    expect(m.getCurrentWeather).toHaveBeenCalledWith(44.47, -73.15);
  });

  it('currentWeather may be null', async () => {
    m.getCurrentWeather.mockResolvedValue(null);
    const { body } = await gql('{ currentWeather(lat: 1, lon: 2) { description } }');
    expect(body).toEqual({ data: { currentWeather: null } });
  });

  it('forecast', async () => {
    m.getForecast.mockResolvedValue([forecastPeriod]);
    const { body } = await gql(
      `query($lat: Float!, $lon: Float!) { forecast(lat: $lat, lon: $lon) {
          name temperature temperatureUnit shortForecast detailedForecast startTime endTime
          isDaytime icon windSpeed windDirection } }`,
      { lat: 44, lon: -72.5 },
    );
    expect(body).toEqual({ data: { forecast: [forecastPeriod] } });
    expect(m.getForecast).toHaveBeenCalledWith(44, -72.5);
  });

  it('alerts', async () => {
    m.getAlerts.mockResolvedValue([alert]);
    const { body } = await gql(
      `{ alerts(state: "VT") { id event headline severity certainty urgency description
          instruction areaDesc effective expires geometry { type coordinates } } }`,
    );
    expect(body).toEqual({ data: { alerts: [alert] } });
    expect(m.getAlerts).toHaveBeenCalledWith('VT');
  });

  it('alerts with null geometry', async () => {
    m.getAlerts.mockResolvedValue([{ ...alert, geometry: null }]);
    const { body } = await gql('{ alerts(state: "VT") { id geometry { type } } }');
    expect(body).toEqual({ data: { alerts: [{ id: alert.id, geometry: null }] } });
  });

  it('mergedAlerts', async () => {
    m.getMergedAlerts.mockResolvedValue([merged]);
    const { body } = await gql(
      `{ mergedAlerts(state: "VT") { id event mergedFrom affectedZoneIds
          geometry { type coordinates } } }`,
    );
    expect(body).toEqual({
      data: {
        mergedAlerts: [
          {
            id: merged.id,
            event: merged.event,
            mergedFrom: merged.mergedFrom,
            affectedZoneIds: merged.affectedZoneIds,
            geometry: merged.geometry,
          },
        ],
      },
    });
    expect(m.getMergedAlerts).toHaveBeenCalledWith('VT');
  });

  it('radarInfo', async () => {
    m.getRadarInfo.mockResolvedValue(radar);
    const { body } = await gql('{ radarInfo { baseUrl tilePattern timestamps { time path } } }');
    expect(body).toEqual({ data: { radarInfo: radar } });
  });

  it('observationStations', async () => {
    m.getObservationStations.mockResolvedValue([station]);
    const { body } = await gql(
      `{ observationStations { id name elevation location { lat lng }
          weather { temperature temperatureUnit description windSpeed windDirection humidity
            dewpoint pressure timestamp } } }`,
    );
    expect(body).toEqual({ data: { observationStations: [station] } });
  });

  it('historicalData passes lat/lng', async () => {
    m.getHistoricalWeather.mockResolvedValue(historical);
    const { body } = await gql(
      `{ historicalData(lat: 44.47, lng: -73.15) { stationName stationDistance
          weather { date tempMin tempMax precipitation snowfall } } }`,
    );
    expect(body).toEqual({ data: { historicalData: historical } });
    expect(m.getHistoricalWeather).toHaveBeenCalledWith(44.47, -73.15);
  });

  it('skiResorts', async () => {
    m.fetchSkiConditions.mockResolvedValue([resort]);
    const { body } = await gql(
      `{ skiResorts { id name latitude longitude logoUrl snowfall24hr snowfallCumulative
          liftsOpen liftsTotal trailsOpen trailsTotal tempCurrent tempHigh tempLow baseDepth
          lastUpdated status color } }`,
    );
    expect(body).toEqual({ data: { skiResorts: [resort] } });
  });

  it('creemeeStands and featuredCreemeeStands', async () => {
    m.fetchCreemeeStands.mockResolvedValue([stand, { ...stand, id: 'c2', featured: false }]);
    m.fetchFeaturedStands.mockResolvedValue([stand]);
    const { body } = await gql(
      `{ creemeeStands { id featured description specialties }
         featuredCreemeeStands { id name town latitude longitude } }`,
    );
    expect(body).toEqual({
      data: {
        creemeeStands: [
          { id: 'c1', featured: true, description: null, specialties: ['maple'] },
          { id: 'c2', featured: false, description: null, specialties: ['maple'] },
        ],
        featuredCreemeeStands: [
          { id: 'c1', name: stand.name, town: stand.town, latitude: 44.19, longitude: -72.82 },
        ],
      },
    });
  });

  it('creemeeStandById returns a stand or null', async () => {
    m.getCreemeeStandById.mockResolvedValueOnce(stand).mockResolvedValueOnce(null);
    const found = await gql('{ creemeeStandById(id: "c1") { id name } }');
    const missing = await gql('query($id: ID!) { creemeeStandById(id: $id) { id } }', {
      id: 404,
    });
    expect(found.body).toEqual({ data: { creemeeStandById: { id: 'c1', name: stand.name } } });
    expect(missing.body).toEqual({ data: { creemeeStandById: null } });
    expect(m.getCreemeeStandById).toHaveBeenNthCalledWith(1, 'c1');
    expect(m.getCreemeeStandById).toHaveBeenNthCalledWith(2, '404'); // ID coerces to string
  });

  it('creemeeStandsByTown', async () => {
    m.getCreemeeStandsByTown.mockResolvedValue([stand]);
    const { body } = await gql('{ creemeeStandsByTown(town: "Waitsfield") { id town } }');
    expect(body).toEqual({ data: { creemeeStandsByTown: [{ id: 'c1', town: 'Waitsfield' }] } });
    expect(m.getCreemeeStandsByTown).toHaveBeenCalledWith('Waitsfield');
  });

  it('beaches', async () => {
    m.fetchBeachWaterQuality.mockResolvedValue([beach]);
    const { body } = await gql(
      `{ beaches { id name town latitude longitude parkType amenities waterQualityGrade
          waterTemp eColiLevel cyanobacteriaCategory lastTested advisory status color
          lastUpdated } }`,
    );
    expect(body).toEqual({ data: { beaches: [beach] } });
  });

  it('recreationSites', async () => {
    m.fetchRecreationSites.mockResolvedValue([recreationSite]);
    const { body } = await gql(
      `{ recreationSites { id name type town isPublic acreage parkingSpaces
          amenities { boatRental picnicArea playground camping { tentSites } swimming { hasBeach } } } }`,
    );
    expect(body).toEqual({
      data: {
        recreationSites: [
          {
            id: 'r1',
            name: recreationSite.name,
            type: 'camping',
            town: 'Elmore',
            isPublic: true,
            acreage: 709,
            parkingSpaces: null,
            amenities: {
              boatRental: true,
              picnicArea: true,
              playground: false,
              camping: null,
              swimming: null,
            },
          },
        ],
      },
    });
  });

  it('backcountrySites', async () => {
    m.fetchBackcountrySites.mockResolvedValue([site]);
    const { body } = await gql(
      `{ backcountrySites { id siteId siteType latitude longitude isAccessible hasFirePit
          hasPicnicTable notes parkId districtId } }`,
    );
    expect(body).toEqual({ data: { backcountrySites: [site] } });
  });

  it('campingAreas passes filters through', async () => {
    m.getCampingAreas.mockResolvedValue([area]);
    const { body } = await gql(
      `{ campingAreas(minSites: 2, types: ["state_forest", "dispersed"]) {
          id name type siteCount centroid { latitude longitude } sites { id } boundary { type } } }`,
    );
    expect(body).toEqual({
      data: {
        campingAreas: [
          {
            id: 'a1',
            name: area.name,
            type: 'state_forest',
            siteCount: 1,
            centroid: area.centroid,
            sites: [{ id: 'b1' }],
            boundary: null,
          },
        ],
      },
    });
    expect(m.getCampingAreas).toHaveBeenCalledWith({
      minSites: 2,
      types: ['state_forest', 'dispersed'],
    });
  });

  it('campingAreas without filters', async () => {
    m.getCampingAreas.mockResolvedValue([]);
    const { body } = await gql('{ campingAreas { id } }');
    expect(body).toEqual({ data: { campingAreas: [] } });
    expect(m.getCampingAreas).toHaveBeenCalledWith({});
  });

  it('serves GET /graphql only with a CSRF-safe header', async () => {
    m.getRadarInfo.mockResolvedValue(radar);
    const url = `/graphql?query=${encodeURIComponent('{ radarInfo { tilePattern } }')}`;

    const blocked = await app.inject({ method: 'GET', url });
    const allowed = await app.inject({
      method: 'GET',
      url,
      headers: { 'apollo-require-preflight': 'true' },
    });

    expect(blocked.statusCode).toBe(400);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ data: { radarInfo: { tilePattern: radar.tilePattern } } });
  });
});

// ---------------------------------------------------------------------------
// Error paths: service throws -> GraphQL error with path + code
// ---------------------------------------------------------------------------

interface ErrorCase {
  field: string;
  query: string;
  fn: ReturnType<typeof vi.fn>;
  nullable: boolean;
  /** Resolvers that wrap upstream errors in a generic message */
  wrapped?: string;
}

const errorCases: ErrorCase[] = [
  {
    field: 'currentWeather',
    query: '{ currentWeather(lat: 1, lon: 2) { description } }',
    fn: m.getCurrentWeather,
    nullable: true,
  },
  {
    field: 'forecast',
    query: '{ forecast(lat: 1, lon: 2) { name } }',
    fn: m.getForecast,
    nullable: false,
  },
  { field: 'alerts', query: '{ alerts(state: "VT") { id } }', fn: m.getAlerts, nullable: false },
  {
    field: 'mergedAlerts',
    query: '{ mergedAlerts(state: "VT") { id } }',
    fn: m.getMergedAlerts,
    nullable: false,
  },
  { field: 'radarInfo', query: '{ radarInfo { baseUrl } }', fn: m.getRadarInfo, nullable: false },
  {
    field: 'observationStations',
    query: '{ observationStations { id } }',
    fn: m.getObservationStations,
    nullable: false,
  },
  {
    field: 'historicalData',
    query: '{ historicalData(lat: 1, lng: 2) { stationName } }',
    fn: m.getHistoricalWeather,
    nullable: false,
  },
  {
    field: 'skiResorts',
    query: '{ skiResorts { id } }',
    fn: m.fetchSkiConditions,
    nullable: false,
  },
  {
    field: 'creemeeStands',
    query: '{ creemeeStands { id } }',
    fn: m.fetchCreemeeStands,
    nullable: false,
  },
  {
    field: 'featuredCreemeeStands',
    query: '{ featuredCreemeeStands { id } }',
    fn: m.fetchFeaturedStands,
    nullable: false,
  },
  {
    field: 'creemeeStandById',
    query: '{ creemeeStandById(id: "x") { id } }',
    fn: m.getCreemeeStandById,
    nullable: true,
  },
  {
    field: 'creemeeStandsByTown',
    query: '{ creemeeStandsByTown(town: "x") { id } }',
    fn: m.getCreemeeStandsByTown,
    nullable: false,
  },
  {
    field: 'beaches',
    query: '{ beaches { id } }',
    fn: m.fetchBeachWaterQuality,
    nullable: false,
    wrapped: 'Failed to fetch beach water quality data',
  },
  {
    field: 'recreationSites',
    query: '{ recreationSites { id } }',
    fn: m.fetchRecreationSites,
    nullable: false,
    wrapped: 'Failed to fetch recreation sites',
  },
  {
    field: 'backcountrySites',
    query: '{ backcountrySites { id } }',
    fn: m.fetchBackcountrySites,
    nullable: false,
    wrapped: 'Failed to fetch backcountry sites',
  },
  {
    field: 'campingAreas',
    query: '{ campingAreas { id } }',
    fn: m.getCampingAreas,
    nullable: false,
    wrapped: 'Failed to fetch camping areas',
  },
];

describe('error paths', () => {
  it.each(errorCases)('$field surfaces a service failure as a GraphQL error', async (c) => {
    c.fn.mockRejectedValue(new Error('upstream exploded'));

    const { status, body } = await gql(c.query);

    expect(status).toBe(200);
    expect(body.data).toEqual(c.nullable ? { [c.field]: null } : null);
    expect(body.errors).toHaveLength(1);
    const [error] = body.errors ?? [];
    expect(error?.path).toEqual([c.field]);
    expect(error?.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    if (c.wrapped) {
      expect(error?.message).toBe(c.wrapped);
    } else {
      expect(error?.message).toBe('upstream exploded');
    }
  });

  it('a failing field does not take down sibling fields', async () => {
    m.getRadarInfo.mockResolvedValue(radar);
    m.getCurrentWeather.mockRejectedValue(new Error('NOAA down'));

    const { body } = await gql(
      '{ radarInfo { tilePattern } currentWeather(lat: 1, lon: 2) { description } }',
    );

    expect(body.data).toEqual({
      radarInfo: { tilePattern: radar.tilePattern },
      currentWeather: null,
    });
    expect(body.errors?.map((e) => e.path)).toEqual([['currentWeather']]);
  });

  it('a service returning a schema-invalid shape is reported, not silently passed', async () => {
    m.getForecast.mockResolvedValue([{ ...forecastPeriod, name: null }]);

    const { body } = await gql('{ forecast(lat: 1, lon: 2) { name } }');

    expect(body.data).toBeNull();
    expect(body.errors?.[0]?.message).toMatch(/non-nullable field ForecastPeriod\.name/);
  });

  it.todo('masks internal error messages in production via formatError (FINDINGS Medium)');
  it.todo('disables introspection in production (FINDINGS Medium)');
  it.todo('rejects over-deep / heavily aliased queries (FINDINGS Medium)');
});

// ---------------------------------------------------------------------------
// Argument validation (rejected before any resolver runs)
// ---------------------------------------------------------------------------

describe('argument validation', () => {
  const invalidQueries: Array<[string, string]> = [
    ['currentWeather missing lon', '{ currentWeather(lat: 1) { description } }'],
    ['currentWeather non-numeric lat', '{ currentWeather(lat: "abc", lon: 2) { description } }'],
    ['forecast missing args', '{ forecast { name } }'],
    ['alerts missing state', '{ alerts { id } }'],
    ['alerts non-string state', '{ alerts(state: 5) { id } }'],
    ['mergedAlerts missing state', '{ mergedAlerts { id } }'],
    ['historicalData missing lng', '{ historicalData(lat: 1) { stationName } }'],
    ['creemeeStandById missing id', '{ creemeeStandById { id } }'],
    ['creemeeStandsByTown missing town', '{ creemeeStandsByTown { id } }'],
    ['campingAreas non-int minSites', '{ campingAreas(minSites: "many") { id } }'],
    ['campingAreas non-string types', '{ campingAreas(types: [1]) { id } }'],
    ['radarInfo unknown argument', '{ radarInfo(foo: 1) { baseUrl } }'],
    ['unknown field', '{ notAField }'],
    ['missing selection set', '{ radarInfo }'],
  ];

  it.each(invalidQueries)('%s -> 400 GRAPHQL_VALIDATION_FAILED', async (_name, query) => {
    const { status, body } = await gql(query);

    expect(status).toBe(400);
    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
    for (const fn of Object.values(m)) expect(fn).not.toHaveBeenCalled();
  });

  it('rejects mistyped variables with BAD_USER_INPUT', async () => {
    const { status, body } = await gql(
      'query($lat: Float!, $lon: Float!) { currentWeather(lat: $lat, lon: $lon) { description } }',
      { lat: 'north', lon: -73 },
    );

    // Apollo 4 answers 200 here unless status400ForVariableCoercionErrors is enabled
    expect([200, 400]).toContain(status);
    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(m.getCurrentWeather).not.toHaveBeenCalled();
  });

  it('rejects missing required variables with BAD_USER_INPUT', async () => {
    const { status, body } = await gql(
      'query($state: String!) { alerts(state: $state) { id } }',
      {},
    );

    expect([200, 400]).toContain(status);
    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(m.getAlerts).not.toHaveBeenCalled();
  });

  it('rejects a syntax error with GRAPHQL_PARSE_FAILED', async () => {
    const { status, body } = await gql('{ radarInfo { baseUrl ');
    expect(status).toBe(400);
    expect(body.errors?.[0]?.extensions?.code).toBe('GRAPHQL_PARSE_FAILED');
  });

  // State-code validation (FINDINGS Low noaa.ts:215) lives in services/noaa.ts and is
  // covered by services/__tests__/noaa.api.test.ts (services are mocked here).
});

describe('beachResolvers (standalone export)', () => {
  it('returns beaches and wraps failures', async () => {
    const { beachResolvers } = await import('../beach.js');
    m.fetchBeachWaterQuality.mockResolvedValueOnce([beach]);
    await expect(beachResolvers.Query.beaches()).resolves.toEqual([beach]);

    m.fetchBeachWaterQuality.mockRejectedValueOnce(new Error('ArcGIS down'));
    await expect(beachResolvers.Query.beaches()).rejects.toThrow(
      'Failed to fetch beach water quality data',
    );
  });
});
