import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import CurrentWeather from '../CurrentWeather';
import {
  fetchCurrentWeather,
  fetchForecast,
  type CurrentWeatherData,
  type ForecastPeriodData,
} from '../../services/graphqlClient';

vi.mock('../../services/graphqlClient', () => ({
  fetchCurrentWeather: vi.fn(),
  fetchForecast: vi.fn(),
}));

const weatherMock = vi.mocked(fetchCurrentWeather);
const forecastMock = vi.mocked(fetchForecast);

const WEATHER: CurrentWeatherData = {
  temperature: 51,
  temperatureUnit: 'F',
  description: 'Light Rain',
  windSpeed: '12 mph',
  windDirection: 'SW',
  humidity: 88.4,
  timestamp: '2026-10-16T12:00:00Z',
  stationName: 'Montpelier Airport',
  icon: null,
};

function period(name: string, temperature: number): ForecastPeriodData {
  return {
    name,
    temperature,
    temperatureUnit: 'F',
    shortForecast: 'Rain',
    detailedForecast: 'Rain likely',
    startTime: '2026-10-16T18:00:00Z',
    endTime: '2026-10-17T06:00:00Z',
    isDaytime: false,
    icon: 'https://api.weather.gov/icons/land/night/rain?size=medium',
    windSpeed: '5 mph',
    windDirection: 'S',
  };
}

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('CurrentWeather', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    weatherMock.mockResolvedValue(WEATHER);
    forecastMock.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => period(`Period ${i + 1}`, 40 + i + 0.4)),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('shows a skeleton while loading', () => {
    weatherMock.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithClient(<CurrentWeather />);
    expect(container.querySelector('.current-weather.loading .weather-skeleton')).not.toBeNull();
  });

  it('renders current conditions for the default location', async () => {
    renderWithClient(<CurrentWeather isDark />);
    expect(await screen.findByText('51')).toBeInTheDocument();
    expect(screen.getByText('°F')).toBeInTheDocument();
    expect(screen.getByText('12 mph SW')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Light Rain')).toBeInTheDocument();
    expect(weatherMock).toHaveBeenCalledWith(44.2601, -72.5754);
    expect(document.querySelector('.current-weather.dark.collapsed')).not.toBeNull();
  });

  it('expands to a six-period forecast and the station name', async () => {
    renderWithClient(<CurrentWeather lat={44.5} lon={-73.2} />);
    fireEvent.click(await screen.findByText('Light Rain'));
    expect(await screen.findByText('Next 3 Days')).toBeInTheDocument();
    expect(screen.getByText('Period 1')).toBeInTheDocument();
    expect(screen.getByText('Period 6')).toBeInTheDocument();
    expect(screen.queryByText('Period 7')).toBeNull();
    expect(screen.getByText('40°')).toBeInTheDocument();
    expect(screen.getByText('Montpelier Airport')).toBeInTheDocument();
    expect(forecastMock).toHaveBeenCalledWith(44.5, -73.2);
  });

  it('omits wind and humidity when they are missing', async () => {
    weatherMock.mockResolvedValue({ ...WEATHER, windSpeed: null, humidity: null });
    const { container } = renderWithClient(<CurrentWeather />);
    await screen.findByText('51');
    expect(container.querySelector('.weather-metrics')?.textContent).toBe('');
  });

  it('shows a minimal view on mobile until expanded', async () => {
    renderWithClient(<CurrentWeather isMobile />);
    await screen.findByText('51');
    expect(screen.queryByText('Light Rain')).toBeNull();
    fireEvent.click(screen.getByText('51'));
    expect(screen.getByText('Light Rain')).toBeInTheDocument();
  });

  it('shows an error state instead of fake placeholder weather when the request fails', async () => {
    weatherMock.mockRejectedValue(new Error('backend down'));
    const { container } = renderWithClient(<CurrentWeather />);
    expect(
      await screen.findByText('Weather unavailable right now', {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    expect(container.querySelector('.temp-value')).toBeNull();
    expect(screen.queryByText('Partly Cloudy')).toBeNull();
  });

  it('omits the forecast instead of showing placeholder periods when it is unavailable', async () => {
    forecastMock.mockRejectedValue(new Error('backend down'));
    renderWithClient(<CurrentWeather />);
    // The component retries twice before giving up
    await waitFor(() => expect(forecastMock).toHaveBeenCalledTimes(3), { timeout: 6000 });
    fireEvent.click(await screen.findByText('Light Rain'));
    expect(screen.queryByText('Next 3 Days')).toBeNull();
    expect(screen.queryByText('Tonight')).toBeNull();
  });
  it.todo('the expandable card is keyboard operable (FINDINGS H15 / a11y)');

  describe('air quality (VTL-75)', () => {
    it('shows the nearest monitor reading with its category color', async () => {
      server.use(
        http.get('*/api/air-quality', () =>
          HttpResponse.json({
            current: {
              id: '500210002',
              name: 'Rutland State St',
              agency: null,
              lat: 43.61,
              lng: -72.98,
              aqi: 59,
              category: 2,
              pollutant: 'PM2.5',
              readings: [{ pollutant: 'PM2.5', aqi: 59, category: 2 }],
              observedAt: '2026-10-26T14:00:00Z',
              distanceMi: 8.4,
            },
            forecast: [],
          }),
        ),
      );
      renderWithClient(<CurrentWeather />);
      const badge = await screen.findByText('AQI 59');
      expect(badge).toHaveClass('aqi-tone');
      expect(badge.style.getPropertyValue('--aqi-color')).toBe('#a16207');
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(badge.closest('.weather-aqi')).toHaveAttribute(
        'title',
        'Fine particles (PM2.5) at the Rutland State St monitor, 8 mi away (EPA AirNow)',
      );
    });

    it('leaves the line out when air quality is unavailable', async () => {
      renderWithClient(<CurrentWeather />);
      await screen.findByText('51');
      // The default handler answers "not configured" (no reading)
      await new Promise((r) => setTimeout(r, 50));
      expect(document.querySelector('.weather-aqi')).toBeNull();
    });
  });

  describe('today vs normal (VTL-81)', () => {
    const CLIMATE = {
      date: '2026-10-16',
      station: { name: 'Montpelier', distanceMi: 4 },
      normalHighF: 56,
      normalLowF: 37,
      recordHigh: { tempF: 78, year: 1947 },
      recordLow: { tempF: 18, year: 1972 },
    };

    it('compares tonight with the normal low and lists normals and records', async () => {
      server.use(http.get('*/api/climate/today', () => HttpResponse.json(CLIMATE)));
      // The first period (night, 40.4°) starts Oct 16 in Vermont
      renderWithClient(<CurrentWeather />);
      const diff = await screen.findByText('3° above normal');
      expect(diff).toHaveClass('warm');
      expect(diff.closest('.weather-normal')).toHaveTextContent('Low tonight 40°, 3° above normal');

      fireEvent.click(screen.getByText('Light Rain'));
      expect(screen.getByText('Today in Montpelier')).toBeInTheDocument();
      expect(screen.getByText('56° / 37°')).toBeInTheDocument();
      expect(screen.getByText('78° (1947)')).toBeInTheDocument();
      expect(screen.getByText('18° (1972)')).toBeInTheDocument();
    });

    it('shows a low-only normal and record (VTL-81)', async () => {
      server.use(
        http.get('*/api/climate/today', () =>
          HttpResponse.json({ ...CLIMATE, normalHighF: null, recordHigh: null }),
        ),
      );
      renderWithClient(<CurrentWeather />);
      fireEvent.click(await screen.findByText('Light Rain'));
      expect(await screen.findByText('Low 37°')).toBeInTheDocument();
      expect(screen.getByText('18° (1972)')).toBeInTheDocument();
    });

    it('leaves the line out when normals are unavailable or for another day', async () => {
      server.use(
        http.get('*/api/climate/today', () =>
          HttpResponse.json({ ...CLIMATE, date: '2026-10-15' }),
        ),
      );
      renderWithClient(<CurrentWeather />);
      await screen.findByText('51');
      await new Promise((r) => setTimeout(r, 50));
      expect(document.querySelector('.weather-normal')).toBeNull();
    });
  });
});
