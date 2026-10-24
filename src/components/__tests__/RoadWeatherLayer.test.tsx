import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RoadWeatherLayer from '../RoadWeatherLayer';
import RoadWeatherDetail from '../detail-views/RoadWeatherDetail';
import { fetchRoadWeather, type RoadWeatherStation } from '../../services/roadWeatherApi';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/roadWeatherApi', () => ({ fetchRoadWeather: vi.fn() }));
const fetchMock = vi.mocked(fetchRoadWeather);

const NOW = new Date().toISOString();
const STATIONS: RoadWeatherStation[] = [
  {
    id: '124',
    name: 'I-89 BERLIN',
    lat: 44.21,
    lng: -72.58,
    roadway: 'I-89',
    direction: 'South',
    location: 'BERLIN .2 MILES SOUTH OF EXIT 7',
    surface: 'Wet',
    pavementTempC: -1, // 30 °F
    airTempC: 0.5,
    dewPointC: -2,
    friction: 0.55,
    precip: 'Snow',
    observedAt: NOW,
  },
  {
    id: '126',
    name: 'I-89 BOLTON',
    lat: 44.38,
    lng: -72.91,
    roadway: 'I-89',
    direction: 'South',
    location: null,
    surface: null,
    pavementTempC: null,
    airTempC: 14.1,
    dewPointC: -1.1,
    friction: null,
    precip: null,
    observedAt: '2020-01-01T00:00:00Z', // stale
  },
];

beforeEach(() => {
  resetMaplibreMock();
  fetchMock.mockResolvedValue(STATIONS);
});
afterEach(() => vi.clearAllMocks());

describe('RoadWeatherLayer', () => {
  it('loads while hidden (for search) but adds markers only when visible', async () => {
    const fake = new FakeMap();
    const onLoaded = vi.fn();
    const { rerender } = render(
      <RoadWeatherLayer
        map={fake.asMap()}
        visible={false}
        onStationClick={vi.fn()}
        onStationsLoaded={onLoaded}
      />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(STATIONS));
    expect(liveMarkers()).toHaveLength(0);

    rerender(
      <RoadWeatherLayer
        map={fake.asMap()}
        visible
        onStationClick={vi.fn()}
        onStationsLoaded={onLoaded}
      />,
    );
    expect(liveMarkers()).toHaveLength(2);

    rerender(
      <RoadWeatherLayer
        map={fake.asMap()}
        visible={false}
        onStationClick={vi.fn()}
        onStationsLoaded={onLoaded}
      />,
    );
    expect(liveMarkers()).toHaveLength(0);
  });

  it('shows pavement °F with risk and staleness classes, and reports clicks', async () => {
    const fake = new FakeMap();
    const onClick = vi.fn();
    render(<RoadWeatherLayer map={fake.asMap()} visible onStationClick={onClick} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [berlin, bolton] = liveMarkers().map((m) => m.getElement());
    expect(berlin!.textContent).toBe('30°');
    expect(berlin!.className).toContain('risk-freezing');
    expect(berlin!.getAttribute('aria-label')).toContain('pavement 30°F');
    // No pavement sensor: air temperature, dashed, greyed when stale
    expect(bolton!.textContent).toBe('57°');
    expect(bolton!.className).toContain('air-only');
    expect(bolton!.className).toContain('stale');

    berlin!.click();
    expect(onClick).toHaveBeenCalledWith(STATIONS[0]);
  });

  it('keeps going when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('502'));
    const fake = new FakeMap();
    render(<RoadWeatherLayer map={fake.asMap()} visible onStationClick={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
  });
});

describe('RoadWeatherDetail', () => {
  it('shows pavement temperature, risk and readings in °F', () => {
    render(<RoadWeatherDetail station={STATIONS[0]!} isDark={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('30°F');
    expect(screen.getByRole('status')).toHaveTextContent('Pavement at or below freezing');
    expect(screen.getByText('33°F')).toBeInTheDocument(); // air 0.5 °C
    expect(screen.getByText('0.55 (fair grip)')).toBeInTheDocument();
    expect(screen.getByText('Snow')).toBeInTheDocument();
  });

  it('flags an old reading', () => {
    render(<RoadWeatherDetail station={STATIONS[1]!} isDark={false} />);
    expect(screen.getByText(/Old reading/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No pavement reading');
  });
});
