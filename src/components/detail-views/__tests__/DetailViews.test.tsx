import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertDetail from '../AlertDetail';
import IncidentDetail from '../IncidentDetail';
import StationDetail from '../StationDetail';
import LocationDetail from '../LocationDetail';
import { useForecast } from '../../../hooks/useForecast';
import type { ForecastPeriod } from '../../../types';
import {
  makeAlertFeature,
  makeDetailIncident,
  makeStation,
  omit,
} from '../../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../../__fixtures__/components/xss';

vi.mock('../../../hooks/useForecast', () => ({ useForecast: vi.fn() }));

type ForecastResult = ReturnType<typeof useForecast>;
const forecastMock = vi.mocked(useForecast);

function forecastState(state: { data?: unknown; isLoading?: boolean; error?: unknown }): void {
  forecastMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...state,
  } as unknown as ForecastResult);
}

function period(n: number, pop: number | null): ForecastPeriod {
  return {
    number: n,
    name: `Period ${n}`,
    startTime: '2026-10-16T18:00:00Z',
    endTime: '2026-10-17T06:00:00Z',
    isDaytime: n % 2 === 1,
    temperature: 40 + n,
    temperatureUnit: 'F',
    temperatureTrend: null,
    windSpeed: '5 mph',
    windDirection: 'S',
    icon: '',
    shortForecast: `Forecast ${n}`,
    detailedForecast: '',
    probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: pop },
  };
}

afterEach(() => {
  delete window.__xss;
});

describe('AlertDetail', () => {
  it('renders the alert fields', () => {
    render(<AlertDetail alert={makeAlertFeature()} isDark />);
    expect(screen.getByText('Severe')).toBeInTheDocument();
    expect(screen.getByText('Winter Storm Warning')).toBeInTheDocument();
    expect(screen.getByText('Winter Storm Warning until 6 PM')).toBeInTheDocument();
    expect(screen.getByText('Washington; Lamoille')).toBeInTheDocument();
    expect(screen.getByText('Heavy snow expected.')).toBeInTheDocument();
    expect(screen.getByText('Avoid travel.')).toBeInTheDocument();
  });

  it('falls back for missing optional fields', () => {
    const alert = makeAlertFeature({ headline: null, instruction: null });
    delete alert.properties.severity;
    delete alert.properties.description;
    delete alert.properties.effective;
    delete alert.properties.expires;
    const { container } = render(<AlertDetail alert={alert} isDark={false} />);
    expect(screen.getByText('Alert')).toBeInTheDocument();
    expect(container.querySelector('.alert-headline')).toBeNull();
    expect(container.querySelector('.alert-description')).toBeNull();
    expect(container.querySelector('.alert-instruction')).toBeNull();
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
  });

  it.each(['Extreme', 'Moderate', 'Minor'])('renders %s severity', (severity) => {
    render(<AlertDetail alert={makeAlertFeature({ severity })} isDark={false} />);
    expect(screen.getByText(severity)).toBeInTheDocument();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <AlertDetail
        alert={makeAlertFeature({
          event: XSS_PAYLOAD,
          headline: XSS_PAYLOAD,
          areaDesc: XSS_PAYLOAD,
          description: XSS_PAYLOAD,
          instruction: XSS_PAYLOAD,
          severity: XSS_PAYLOAD,
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('IncidentDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders type, severity, location and relative times', () => {
    render(
      <IncidentDetail
        incident={makeDetailIncident({ endTime: '2026-10-13T12:00:00Z' })}
        isDark={false}
      />,
    );
    expect(screen.getByText('Paving on US-2')).toBeInTheDocument();
    expect(screen.getByText('Severity: Moderate')).toBeInTheDocument();
    expect(screen.getByText('US-2 (EB)')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    expect(screen.getByText('3 days ago')).toBeInTheDocument();
    expect(screen.getByText('Source: VT511')).toBeInTheDocument();
  });

  it.each([
    ['ACCIDENT', '2026-10-16T11:59:00Z', '1 min ago'],
    ['CLOSURE', '2026-10-16T11:55:00Z', '5 mins ago'],
    ['FLOODING', '2026-10-15T12:00:00Z', '1 day ago'],
    ['HAZARD', '2026-10-16T12:00:00Z', 'Just now'],
  ] as const)('renders %s incidents (%s -> %s)', (type, lastUpdated, label) => {
    const { container } = render(
      <IncidentDetail
        incident={omit(makeDetailIncident({ type, lastUpdated }), 'road', 'startTime')}
        isDark
      />,
    );
    expect(container.querySelector('.incident-detail')).toHaveAttribute(
      'data-incident-type',
      type.toLowerCase(),
    );
    expect(container.querySelector('.incident-type-badge svg')).not.toBeNull();
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText('Location')).toBeNull();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <IncidentDetail
        incident={makeDetailIncident({
          title: XSS_PAYLOAD,
          description: XSS_PAYLOAD,
          road: XSS_PAYLOAD,
          direction: XSS_PAYLOAD,
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('StationDetail', () => {
  it('renders all available readings', () => {
    render(<StationDetail station={makeStation()} isDark={false} />);
    expect(screen.getByText('Barre-Montpelier Airport')).toBeInTheDocument();
    expect(screen.getByText('44.2000°N, 72.5600°W')).toBeInTheDocument();
    expect(screen.getByText('Elevation: 1,165 ft')).toBeInTheDocument();
    expect(screen.getByText('45°F')).toBeInTheDocument();
    expect(screen.getByText('10 mph NW')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('36°F')).toBeInTheDocument();
    expect(screen.getByText('Cloudy')).toBeInTheDocument();
  });

  it('omits missing readings', () => {
    const base = makeStation();
    const { container } = render(
      <StationDetail
        station={makeStation({
          location: { lat: -10, lng: 20 },
          elevation: null,
          weather: {
            ...base.weather,
            windSpeed: null,
            humidity: null,
            dewpoint: null,
            pressure: null,
          },
        })}
        isDark
      />,
    );
    expect(screen.getByText('10.0000°S, 20.0000°E')).toBeInTheDocument();
    expect(container.querySelector('.station-elevation')).toBeNull();
    expect(container.querySelectorAll('.condition-card')).toHaveLength(1);
  });

  it('renders hostile strings as text', () => {
    const base = makeStation();
    const { container } = render(
      <StationDetail
        station={makeStation({
          name: XSS_PAYLOAD,
          weather: {
            ...base.weather,
            description: XSS_PAYLOAD,
            windSpeed: XSS_PAYLOAD,
            windDirection: XSS_PAYLOAD,
          },
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('LocationDetail', () => {
  const coords = { lat: 44.2601, lng: -72.5754 };

  it('requests the forecast for the coordinates and shows loading', () => {
    forecastState({ isLoading: true });
    render(<LocationDetail coordinates={coords} isDark={false} />);
    expect(forecastMock).toHaveBeenCalledWith({ lat: coords.lat, lng: coords.lng, enabled: true });
    expect(screen.getByText('Loading forecast...')).toBeInTheDocument();
    expect(screen.getByText('44.2601°N, 72.5754°W')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    forecastState({ error: new Error('down') });
    render(<LocationDetail coordinates={coords} isDark={false} />);
    expect(screen.getByText('Unable to load forecast')).toBeInTheDocument();
    expect(screen.queryByText('No forecast data available')).toBeNull();
  });

  it('shows the empty state', () => {
    forecastState({ data: { forecast: [] } });
    render(<LocationDetail coordinates={coords} isDark={false} />);
    expect(screen.getByText('No forecast data available')).toBeInTheDocument();
  });

  it('renders up to six forecast periods with precipitation chances', () => {
    forecastState({
      data: { forecast: Array.from({ length: 8 }, (_, i) => period(i + 1, i === 0 ? 60 : null)) },
    });
    const { container } = render(<LocationDetail coordinates={coords} isDark />);
    expect(container.querySelectorAll('.forecast-period')).toHaveLength(6);
    expect(screen.getByText('Period 1')).toBeInTheDocument();
    expect(screen.queryByText('Period 7')).toBeNull();
    expect(screen.getByText('60% chance')).toBeInTheDocument();
    expect(container.querySelectorAll('.period-precip')).toHaveLength(1);
  });

  it('renders the astronomy section', () => {
    forecastState({ data: { forecast: [] } });
    render(<LocationDetail coordinates={{ lat: -33.9, lng: 18.4 }} isDark={false} />);
    expect(screen.getByText('33.9000°S, 18.4000°E')).toBeInTheDocument();
    for (const label of [
      'Sunrise',
      'Sunset',
      'Morning Golden Hour',
      'Evening Golden Hour',
      'Astronomical Twilight',
      'Moon Phase',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders hostile forecast strings as text', () => {
    forecastState({
      data: { forecast: [{ ...period(1, null), name: XSS_PAYLOAD, shortForecast: XSS_PAYLOAD }] },
    });
    const { container } = render(<LocationDetail coordinates={coords} isDark={false} />);
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});
