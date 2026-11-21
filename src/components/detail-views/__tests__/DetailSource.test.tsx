/**
 * Every detail window and the alert popup ends with a source line that links
 * to a public page in a new tab (VTL-96).
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import DetailContent from '../DetailContent';
import AlertPopup from '../../AlertPopup';
import { DetailSource } from '../DetailParts';
import type { DetailPanelContent } from '../../../types';
import type { FireDangerAreaView } from '../../../services/fireDangerApi';
import type { AirQualityMonitor } from '../../../services/airQualityApi';
import type { RiverGauge } from '../../../services/riverApi';
import type { EvCharger } from '../../../services/evChargerApi';
import { FERRIES } from '../../../data/ferries';
import { SEASONAL_ROADS } from '../../../data/seasonalRoads';
import {
  makeAlertFeature,
  makeBeach,
  makeCampingArea,
  makeCreemeeStand,
  makeDarkSkySite,
  makeRecreationSite,
  makeRoadWeatherStation,
  makeSkiResort,
  makeStation,
  makeVT511Incident,
} from '../../../__fixtures__/components/data';

vi.mock('../../../hooks/useForecast', () => ({
  useForecast: () => ({ data: undefined, isLoading: false, error: null }),
}));
vi.mock('../../../hooks/useAirQuality', () => ({ useAirQuality: () => ({ data: undefined }) }));
vi.mock('../../../hooks/useRiverGauge', () => ({
  useRiverGauge: () => ({
    data: {
      id: 'ESSV1',
      usgsId: '04290500',
      county: 'Chittenden',
      floodStages: { action: null, minor: null, moderate: null, major: null },
      impacts: [],
      historicCrests: [],
      observed: [],
      forecast: [],
      forecastIssuedAt: null,
    },
    isError: false,
  }),
}));
vi.mock('../../../hooks/useSkiWebcams', () => ({
  useSkiWebcams: () => ({
    data: {
      checkedAt: '2026-11-21T12:00:00Z',
      youtubeLookup: false,
      resorts: {
        stowe: { page: 'https://www.stowe.com/webcams', camera: null, status: 'offline' },
      },
    },
  }),
}));
vi.mock('../../../hooks/useCameraSite', () => ({
  useCameraLocation: () => ({ data: undefined }),
  useSiteRoadWeather: () => null,
}));
vi.mock('../../../services/cameraApi', () => ({
  fetchCameraImage: () => Promise.resolve(null),
}));

const now = new Date().toISOString();

const MONITOR: AirQualityMonitor = {
  id: '500070007',
  name: 'Burlington',
  agency: 'Vermont Air Quality & Climate Division',
  lat: 44.48,
  lng: -73.21,
  aqi: 30,
  category: 1,
  pollutant: 'OZONE',
  readings: [{ pollutant: 'OZONE', aqi: 30, category: 1 }],
  observedAt: now,
};

const GAUGE: RiverGauge = {
  id: 'ESSV1',
  name: 'Winooski River at Essex Junction',
  state: 'VT',
  lat: 44.49,
  lng: -73.11,
  stageFt: 4.2,
  flowCfs: 900,
  category: 'no_flooding',
  observedAt: now,
  forecastCategory: null,
  forecastStageFt: null,
  forecastAt: null,
};

const CHARGER: EvCharger = {
  id: '102480',
  name: 'Berlin Supercharger',
  address: '213 Payne Turnpike',
  city: 'Berlin',
  lat: 44.21,
  lng: -72.58,
  network: 'Tesla',
  networkUrl: 'https://www.tesla.com/supercharger',
  dcFastPorts: 8,
  level2Ports: 0,
  maxKw: 150,
  connectors: ['NACS (Tesla)'],
  hours: null,
  pricing: null,
  facility: null,
  lastConfirmed: '2026-06-18',
};

const FIRE: FireDangerAreaView = {
  id: '3',
  name: 'Champlain Valley',
  description: 'Champlain Islands south to Brandon',
  rating: 2,
  labelLat: 44.4,
  labelLng: -73.1,
  geometry: { type: 'Polygon', coordinates: [] },
  notes: null,
  preparedness: null,
  updatedAt: now,
};

/** Every window type, with the source(s) its footer must link */
const CASES: [label: string, content: DetailPanelContent, links: [name: string, href: RegExp][]][] =
  [
    [
      'alert',
      { type: 'alert', data: makeAlertFeature({ affectedZoneIds: ['VTZ006'] }) },
      [['National Weather Service', /^https:\/\/forecast\.weather\.gov\/.*zoneid=VTZ006$/]],
    ],
    [
      'incident (511)',
      { type: 'incident', data: makeVT511Incident() },
      [['New England 511', /^https:\/\/newengland511\.org\/$/]],
    ],
    [
      'station',
      { type: 'station', data: makeStation({ id: 'KBTV' }) },
      [['National Weather Service', /timeseries\?site=KBTV$/]],
    ],
    [
      'water temperature station',
      { type: 'station', data: makeStation({ id: 'USGS-04294500' }) },
      [['U.S. Geological Survey', /monitoring-location\/04294500\/$/]],
    ],
    [
      'camera',
      {
        type: 'camera',
        data: {
          id: 'CAM1',
          name: 'I-89 Berlin',
          lat: 44.2,
          lng: -72.6,
          roadway: 'I-89',
          direction: null,
          online: true,
        },
      },
      [
        ['VTrans', /^https:\/\/vtrans\.vermont\.gov\/$/],
        ['New England 511', /newengland511\.org/],
      ],
    ],
    [
      'road weather',
      { type: 'roadWeather', data: makeRoadWeatherStation() },
      [
        ['VTrans', /vtrans\.vermont\.gov/],
        ['New England 511', /newengland511\.org/],
      ],
    ],
    [
      'air quality',
      { type: 'airQuality', data: MONITOR },
      [['EPA AirNow', /^https:\/\/www\.airnow\.gov\/$/]],
    ],
    [
      'river gauge',
      { type: 'river', data: GAUGE },
      [
        ['National Weather Service', /^https:\/\/water\.noaa\.gov\/gauges\/ESSV1$/],
        ['U.S. Geological Survey', /monitoring-location\/04290500\/$/],
      ],
    ],
    [
      'EV charger',
      { type: 'evCharger', data: CHARGER },
      [
        [
          'U.S. DOE Alternative Fuels Data Center',
          /afdc\.energy\.gov\/stations#\/station\/102480$/,
        ],
      ],
    ],
    [
      'fire danger',
      { type: 'fireDanger', data: FIRE },
      [['Vermont Forests, Parks & Recreation', /^https:\/\/fpr\.vermont\.gov\//]],
    ],
    [
      'ferry',
      {
        type: 'ferry',
        data: FERRIES[0]!,
        status: { tone: 'good', label: 'Running today' },
      } as DetailPanelContent,
      [
        [FERRIES[0]!.operator, /^https:\/\//],
        ['OpenStreetMap', /openstreetmap\.org\/copyright$/],
      ],
    ],
    [
      'ski area',
      { type: 'ski', data: makeSkiResort() },
      [
        ['Ski Vermont', /^https:\/\/skivermont\.com\/conditions$/],
        ['Stowe webcams', /^https:\/\/www\.stowe\.com\/webcams$/],
      ],
    ],
    [
      'beach (Burlington)',
      { type: 'beach', data: makeBeach() },
      [['City of Burlington', /^https:\/\/enjoyburlington\.com\//]],
    ],
    [
      'beach (state park, unmonitored)',
      {
        type: 'beach',
        data: makeBeach({
          parkType: 'state_park',
          status: 'unknown',
          lastTested: null,
          waterQualityGrade: null,
          eColiLevel: null,
        }),
      },
      [['Vermont State Parks', /^https:\/\/vtstateparks\.com\/$/]],
    ],
    [
      'campground',
      { type: 'campground', data: makeRecreationSite() },
      [['Vermont ANR', /^https:\/\/geodata\.vermont\.gov\/$/]],
    ],
    [
      'camping area',
      { type: 'campingArea', data: makeCampingArea() },
      [['Vermont ANR', /geodata\.vermont\.gov/]],
    ],
    ['creemee stand', { type: 'creemee', data: makeCreemeeStand() }, []],
    ['dark sky site', { type: 'darkSky', data: makeDarkSkySite() }, []],
    [
      'seasonal road',
      {
        type: 'seasonalRoad',
        data: SEASONAL_ROADS[0]!,
        status: { status: 'open', label: 'Open' },
      },
      [['VCGI', /^https:\/\/vcgi\.vermont\.gov\/$/]],
    ],
    [
      "what's here",
      { type: 'location', coordinates: { lat: 44.26, lng: -72.58 } },
      [['National Weather Service', /MapClick\.php\?lat=44\.2600&lon=-72\.5800$/]],
    ],
  ];

const CURATED = new Set([
  'creemee stand',
  'dark sky site',
  'seasonal road',
  'ferry',
  'beach (state park, unmonitored)',
]);

function expectSourceLine(container: HTMLElement, links: [string, RegExp][]): HTMLElement {
  const lines = container.querySelectorAll('.detail-source');
  expect(lines).toHaveLength(1);
  const line = lines[0] as HTMLElement;
  const anchors = [...line.querySelectorAll('a')];
  expect(anchors.map((a) => a.textContent)).toEqual(links.map(([name]) => name));
  anchors.forEach((a, i) => {
    const href = a.getAttribute('href')!;
    expect(href).toMatch(links[i]![1]);
    expect(new URL(href).protocol).toBe('https:');
    expect(new URL(href).hostname).not.toMatch(/^api\./);
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });
  return line;
}

describe('source line in every detail window (VTL-96)', () => {
  it.each(CASES)('%s', (label, content, links) => {
    const { container } = render(<DetailContent content={content} isDark={false} />);
    const line = expectSourceLine(container, links);
    expect(line.textContent).toMatch(CURATED.has(label) ? /^Curated by VT LiveView/ : /^Source: /);
    // The source line is the window's last element
    expect(line.parentElement!.lastElementChild).toBe(line);
  });

  it('in the alert popup, linking the shown alert', () => {
    const alert = makeAlertFeature({ affectedZoneIds: ['VTZ003'] });
    const { container } = render(
      <AlertPopup
        alerts={[alert]}
        isDark={false}
        selectedKey={null}
        onSelect={() => {}}
        onDetails={() => {}}
        onDismiss={() => {}}
      />,
    );
    expectSourceLine(container, [['National Weather Service', /zoneid=VTZ003$/]]);
  });
});

describe('DetailSource', () => {
  it('joins sources and appends the note', () => {
    const { container } = render(
      <DetailSource
        sources={[{ name: 'A', href: 'https://a.example/' }, { name: 'B' }, { name: 'C' }]}
      >
        updated now
      </DetailSource>,
    );
    expect(container.textContent).toBe('Source: A, B and C · updated now');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('says curated, with or without credits', () => {
    expect(render(<DetailSource curated />).container.textContent).toBe('Curated by VT LiveView');
    expect(
      render(<DetailSource curated sources={[{ name: 'VCGI' }]} />).container.textContent,
    ).toBe('Curated by VT LiveView from VCGI');
  });
});
