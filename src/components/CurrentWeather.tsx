import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentWeather, fetchForecast, type CurrentWeatherData, type ForecastPeriodData } from '../services/graphqlClient';
import { Wind, Droplets, ChevronDown } from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import { getWeatherIconName, getWeatherIconFromNOAAUrl } from '../utils/weatherIconMapping';
import { isCurrentlyDaytime } from '../utils/time';
import './CurrentWeather.css';

// Default location: Montpelier, VT
const DEFAULT_LAT = 44.2601;
const DEFAULT_LON = -72.5754;

interface CurrentWeatherProps {
  lat?: number;
  lon?: number;
  isDark?: boolean;
  isMobile?: boolean;
}

export default function CurrentWeather({ lat = DEFAULT_LAT, lon = DEFAULT_LON, isDark = false, isMobile = false }: CurrentWeatherProps) {
  // Default to collapsed for better map visibility
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<CurrentWeatherData | null>({
    queryKey: ['currentWeather', lat, lon],
    queryFn: () => fetchCurrentWeather(lat, lon),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2,
    placeholderData: (previousData) => previousData // Keep previous data during refetch to prevent flashing
  });

  const { data: forecastData } = useQuery<ForecastPeriodData[] | null>({
    queryKey: ['forecast', lat, lon],
    queryFn: () => fetchForecast(lat, lon),
    staleTime: 15 * 60 * 1000, // 15 minutes (forecast changes less often)
    refetchInterval: 15 * 60 * 1000,
    retry: 2,
    placeholderData: (previousData) => previousData // Keep previous data during refetch
  });

  if (isLoading) {
    return (
      <div className={`current-weather loading ${isDark ? 'dark' : ''}`}>
        <div className="weather-skeleton">
          <div className="skeleton-line large" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line small" />
        </div>
      </div>
    );
  }

  // Use dummy data if there's an error or no data
  const weatherData = data || {
    temperature: 32,
    temperatureUnit: 'F',
    description: 'Partly Cloudy',
    windSpeed: 8,
    windDirection: 'NW',
    humidity: 65,
    location: 'Montpelier, VT'
  };

  // Filter to 3-day forecast (6 periods = 3 days of day/night) or use dummy data
  const forecast3Day = forecastData?.slice(0, 6) || [];
  const forecast = forecast3Day.length > 0 ? forecast3Day : [
    { name: 'Tonight', temperature: 28, shortForecast: 'Mostly Clear', icon: 'https://api.weather.gov/icons/land/night/few?size=medium' },
    { name: 'Wednesday', temperature: 38, shortForecast: 'Sunny', icon: 'https://api.weather.gov/icons/land/day/skc?size=medium' },
    { name: 'Wednesday Night', temperature: 25, shortForecast: 'Clear', icon: 'https://api.weather.gov/icons/land/night/skc?size=medium' },
    { name: 'Thursday', temperature: 41, shortForecast: 'Partly Cloudy', icon: 'https://api.weather.gov/icons/land/day/sct?size=medium' },
    { name: 'Thursday Night', temperature: 30, shortForecast: 'Cloudy', icon: 'https://api.weather.gov/icons/land/night/ovc?size=medium' },
    { name: 'Friday', temperature: 36, shortForecast: 'Chance Snow', icon: 'https://api.weather.gov/icons/land/day/snow?size=medium' }
  ];

  // Mobile collapsed: ultra-minimal view (just temp + icon)
  const showMinimalView = isMobile && !isExpanded;

  return (
    <div
      className={`current-weather ${isDark ? 'dark' : ''} ${isExpanded ? 'expanded' : 'collapsed'} ${isMobile ? 'mobile' : ''}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="weather-main">
        <div className="weather-icon">
          <WeatherIcon
            name={getWeatherIconName(weatherData.description, !isCurrentlyDaytime(lat, lon))}
            size={48}
          />
        </div>
        <div className="weather-info">
          <div className="temperature">
            <span className="temp-value">{weatherData.temperature ?? '--'}</span>
            <span className="temp-unit">°{weatherData.temperatureUnit}</span>
          </div>
          {!showMinimalView && (
            <div className="weather-metrics">
              {weatherData.windSpeed && (
                <>
                  <Wind size={14} />
                  <span>{weatherData.windSpeed} {weatherData.windDirection}</span>
                </>
              )}
              {weatherData.humidity !== null && weatherData.humidity !== undefined && (
                <>
                  {weatherData.windSpeed && <span className="metric-separator">•</span>}
                  <Droplets size={14} />
                  <span>{Math.round(weatherData.humidity)}%</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hide description when mobile collapsed */}
      {!showMinimalView && (
        <div className="weather-description">
          {weatherData.description}
        </div>
      )}

      {isExpanded && (
        <>
          {/* 3-Day Forecast */}
          {forecast.length > 0 && (
            <div className="forecast-section">
              <div className="forecast-title">Next 3 Days</div>
              <div className="forecast-cards">
                {forecast.map((period, index) => (
                  <div key={index} className="forecast-card">
                    <div className="forecast-period-label">{period.name}</div>
                    <div className="forecast-icon">
                      <WeatherIcon
                        name={getWeatherIconFromNOAAUrl(period.icon)}
                        size={48}
                      />
                    </div>
                    <div className="forecast-temperature">
                      {Math.round(period.temperature)}°
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.stationName && (
            <div className="station-name">
              {data.stationName}
            </div>
          )}
        </>
      )}

      <div className={`expand-indicator ${isExpanded ? 'expanded' : ''}`}>
        <ChevronDown size={20} />
      </div>
    </div>
  );
}
