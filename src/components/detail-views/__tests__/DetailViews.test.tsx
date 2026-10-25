import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertDetail from '../AlertDetail';
import IncidentDetail from '../IncidentDetail';
import StationDetail from '../StationDetail';
import LocationDetail from '../LocationDetail';
import { useForecast } from '../../../hooks/useForecast';
import type { ForecastPeriod } from '../../../types';
import {
  makeAlertFeature,
  makeVT511Incident,
  makeStation,
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
  it('shows the layer badge, road, details and source (VTL-64)', () => {
    const { container } = render(
      <IncidentDetail
        incident={makeVT511Incident({
          type: 'CLOSURE',
          title: 'Bridge out on VT-100',
          description: 'Detour via VT-17',
          roadName: 'VT-100',
          affectedLanes: 'All lanes closed',
          roadRestrictions: { weight: '72000', width: null },
        })}
        isDark={false}
      />,
    );
    const badge = container.querySelector('.layer-badge') as HTMLElement;
    expect(badge).toHaveTextContent('Road closure');
    expect(badge.style.getPropertyValue('--layer-color')).toBe('#dc2626');
    expect(screen.getByText('Bridge out on VT-100')).toBeInTheDocument();
    expect(screen.getByText('VT-100')).toBeInTheDocument();
    expect(screen.getByText('Detour via VT-17')).toBeInTheDocument();
    expect(screen.getByText('All lanes closed')).toBeInTheDocument();
    expect(screen.getByText('72,000 lbs')).toBeInTheDocument();
    expect(screen.queryByText('Width limit')).toBeNull();
    expect(screen.getByText('Source: VT 511')).toBeInTheDocument();
  });

  it('skips a description that only repeats the title', () => {
    const { container } = render(
      <IncidentDetail
        incident={makeVT511Incident({ title: 'Crash', description: 'Crash' })}
        isDark
      />,
    );
    expect(container.querySelector('.incident-description')).toBeNull();
  });

  it('renders hostile strings as text', () => {
    const { container } = render(
      <IncidentDetail
        incident={makeVT511Incident({
          title: XSS_PAYLOAD,
          description: `${XSS_PAYLOAD} more`,
          roadName: XSS_PAYLOAD,
        })}
        isDark={false}
      />,
    );
    expectNoInjectedMarkup(container);
    expectPayloadAsText(container);
  });
});

describe('StationDetail', () => {
  it('warns when the reading is old (VTL-50)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T15:00:00Z'));
    render(<StationDetail station={makeStation()} isDark={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(
      /^This reading is from 3 hr ago \(as of .+\) and may not reflect current conditions\.$/,
    );
    vi.useRealTimers();
  });

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
