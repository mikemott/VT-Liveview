import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentWeather, fetchForecast, type CurrentWeatherData, type ForecastPeriodData } from '../services/graphqlClient';
import { Wind, Droplets, ChevronDown } from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import { getWeatherIconName } from '../utils/weatherIconMapping';
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
  // Default to collapsed on mobile for better map visibility
  const [isExpanded, setIsExpanded] = useState(!isMobile);

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

  // Filter to 3-day forecast (6 periods = 3 days of day/night)
  const forecast3Day = forecastData?.slice(0, 6) || [];

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

  if (error || !data) {
    return (
      <div className={`current-weather error ${isDark ? 'dark' : ''}`}>
        <p>Unable to load weather</p>
      </div>
    );
  }

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
            name={getWeatherIconName(data.description, !isCurrentlyDaytime(lat, lon))}
            size={48}
          />
        </div>
        <div className="weather-info">
          <div className="temperature">
            <span className="temp-value">{data.temperature ?? '--'}</span>
            <span className="temp-unit">°{data.temperatureUnit}</span>
          </div>
          {!showMinimalView && (
            <div className="weather-metrics">
              {data.windSpeed && (
                <>
                  <Wind size={14} />
                  <span>{data.windSpeed} {data.windDirection}</span>
                </>
              )}
              {data.humidity !== null && data.humidity !== undefined && (
                <>
                  <span className="metric-separator">•</span>
                  <Droplets size={14} />
                  <span>{Math.round(data.humidity)}%</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hide description when mobile collapsed */}
      {!showMinimalView && (
        <div className="weather-description">
          {data.description}
        </div>
      )}

      {isExpanded && (
        <>
          {/* 3-Day Forecast */}
          {forecast3Day.length > 0 && (
            <div className="forecast-section">
              <div className="forecast-title">Next 3 Days</div>
              <div className="forecast-cards">
                {forecast3Day.map((period, index) => (
                  <div key={index} className="forecast-card">
                    <div className="forecast-period-label">{period.name}</div>
                    <div className="forecast-icon">
                      <WeatherIcon
                        name={getWeatherIconName(period.shortForecast, !period.isDaytime)}
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
