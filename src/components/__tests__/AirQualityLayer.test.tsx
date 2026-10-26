import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AirQualityLayer from '../AirQualityLayer';
import AirQualityDetail from '../detail-views/AirQualityDetail';
import { fetchAirQualityMonitors, type AirQualityMonitor } from '../../services/airQualityApi';
import { useAirQuality } from '../../hooks/useAirQuality';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/airQualityApi', () => ({ fetchAirQualityMonitors: vi.fn() }));
vi.mock('../../hooks/useAirQuality', () => ({ useAirQuality: vi.fn() }));
const fetchMock = vi.mocked(fetchAirQualityMonitors);
const useAirQualityMock = vi.mocked(useAirQuality);

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const thisHour = new Date(Math.floor(Date.now() / 3600_000) * 3600_000).toISOString();

const MONITORS: AirQualityMonitor[] = [
  {
    id: '500210002',
    name: 'Rutland',
    agency: 'Vermont Air Quality & Climate Division',
    lat: 43.6085,
    lng: -72.9822,
    aqi: 112,
    category: 3,
    pollutant: 'PM2.5',
    readings: [
      { pollutant: 'PM2.5', aqi: 112, category: 3 },
      { pollutant: 'OZONE', aqi: 30, category: 1 },
    ],
    observedAt: thisHour,
  },
  {
    id: '330090010',
    name: 'Lebanon',
    agency: 'New Hampshire Dept. of Environmental Services',
    lat: 43.6295,
    lng: -72.3093,
    aqi: 39,
    category: 1,
    pollutant: 'PM2.5',
    readings: [{ pollutant: 'PM2.5', aqi: 39, category: 1 }],
    observedAt: '2020-01-01T00:00:00Z', // stale
  },
];

beforeEach(() => {
  resetMaplibreMock();
  fetchMock.mockResolvedValue(MONITORS);
  useAirQualityMock.mockReturnValue({
    data: {
      current: null,
      forecast: [
        {
          date: today,
          aqi: 95,
          category: 2,
          pollutant: 'PM2.5',
          reportingArea: 'Rutland',
          actionDay: false,
        },
      ],
    },
  } as unknown as ReturnType<typeof useAirQuality>);
});
afterEach(() => vi.clearAllMocks());

describe('AirQualityLayer (VTL-76)', () => {
  it('loads while hidden (for search) but adds markers only when visible', async () => {
    const fake = new FakeMap();
    const onLoaded = vi.fn();
    const { rerender } = render(
      <AirQualityLayer
        map={fake.asMap()}
        visible={false}
        onMonitorClick={vi.fn()}
        onMonitorsLoaded={onLoaded}
      />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(MONITORS));
    expect(liveMarkers()).toHaveLength(0);

    rerender(
      <AirQualityLayer
        map={fake.asMap()}
        visible
        onMonitorClick={vi.fn()}
        onMonitorsLoaded={onLoaded}
      />,
    );
    expect(liveMarkers()).toHaveLength(2);
  });

  it('shows the AQI tinted by category, dims old readings, and reports clicks', async () => {
    const fake = new FakeMap();
    const onClick = vi.fn();
    render(<AirQualityLayer map={fake.asMap()} visible onMonitorClick={onClick} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [rutland, lebanon] = liveMarkers().map((m) => m.getElement());
    expect(rutland!.textContent).toBe('112');
    expect(rutland!.dataset.layer).toBe('airQuality');
    expect(rutland!.className).toContain('aqi-3');
    expect(rutland!.style.getPropertyValue('--marker-fill')).toBe('#ea580c');
    expect(rutland!.getAttribute('aria-label')).toBe(
      'Air quality: Rutland, AQI 112, unhealthy for sensitive groups (Fine particles (PM2.5))',
    );
    expect(lebanon!.className).toContain('stale');
    expect(lebanon!.getAttribute('aria-label')).toContain('(old reading)');

    rutland!.click();
    expect(onClick).toHaveBeenCalledWith(MONITORS[0]);
  });

  it('keeps going when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('502'));
    const fake = new FakeMap();
    render(<AirQualityLayer map={fake.asMap()} visible onMonitorClick={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
  });
});

describe('AirQualityDetail', () => {
  it('shows the AQI, advice, each pollutant and the area forecast', () => {
    render(<AirQualityDetail monitor={MONITORS[0]!} isDark={false} />);
    const headline = screen.getByRole('status');
    expect(headline).toHaveTextContent('112');
    expect(headline).toHaveTextContent('Unhealthy for Sensitive Groups');
    expect(screen.getByText(/older adults and children should limit/)).toBeInTheDocument();
    expect(screen.getByText('Fine particles (PM2.5)')).toBeInTheDocument();
    expect(screen.getByText('Ozone')).toBeInTheDocument();
    expect(screen.getByText('Forecast · Rutland area')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Air quality forecast' })).toHaveTextContent('AQI 95');
    expect(screen.getByText(/Vermont has only a few air quality monitors/)).toBeInTheDocument();
    expect(useAirQualityMock).toHaveBeenCalledWith(43.6085, -72.9822);
  });

  it('flags an old reading and says when a monitor is outside Vermont', () => {
    useAirQualityMock.mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useAirQuality
    >);
    render(<AirQualityDetail monitor={MONITORS[1]!} isDark={false} />);
    expect(screen.getByText(/Old reading/)).toBeInTheDocument();
    expect(screen.getByText(/Just outside Vermont/)).toBeInTheDocument();
    expect(screen.queryByText(/Forecast/)).toBeNull();
  });
});
