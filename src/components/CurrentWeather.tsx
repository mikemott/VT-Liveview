import { useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentWeather, fetchForecast, type CurrentWeatherData, type ForecastPeriodData } from '../services/graphqlClient';
import {
  Wind,
  Droplets,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudMoon,
  Moon,
  ChevronDown
} from 'lucide-react';
import './CurrentWeather.css';

// Default location: Montpelier, VT
const DEFAULT_LAT = 44.2601;
const DEFAULT_LON = -72.5754;

interface CurrentWeatherProps {
  lat?: number;
  lon?: number;
  isDark?: boolean;
}

function getWeatherIcon(description: string | undefined, isDark: boolean): ReactNode {
  const desc = description?.toLowerCase() || '';

  if (desc.includes('rain') || desc.includes('showers')) {
    return <CloudRain size={48} />;
  }
  if (desc.includes('snow')) {
    return <CloudSnow size={48} />;
  }
  if (desc.includes('cloud') && desc.includes('sun')) {
    return isDark ? <CloudMoon size={48} /> : <CloudSun size={48} />;
  }
  if (desc.includes('cloud') || desc.includes('overcast')) {
    return <Cloud size={48} />;
  }
  if (desc.includes('clear') || desc.includes('sunny') || desc.includes('fair')) {
    return isDark ? <Moon size={48} /> : <Sun size={48} />;
  }
  return <Cloud size={48} />;
}

export default function CurrentWeather({ lat = DEFAULT_LAT, lon = DEFAULT_LON, isDark = false }: CurrentWeatherProps) {
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

  return (
    <div
      className={`current-weather ${isDark ? 'dark' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="weather-main">
        <div className="weather-icon">
          {getWeatherIcon(data.description, isDark)}
        </div>
        <div className="temperature">
          <span className="temp-value">{data.temperature ?? '--'}</span>
          <span className="temp-unit">°{data.temperatureUnit}</span>
        </div>
      </div>

      <div className="weather-description">
        {data.description}
      </div>

      <div className="weather-details">
        {data.windSpeed && (
          <div className="detail-item">
            <Wind size={16} />
            <span>{data.windSpeed} {data.windDirection}</span>
          </div>
        )}
        {data.humidity !== null && data.humidity !== undefined && (
          <div className="detail-item">
            <Droplets size={16} />
            <span>{Math.round(data.humidity)}%</span>
          </div>
        )}
      </div>

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
                      {getWeatherIcon(period.shortForecast, period.name.toLowerCase().includes('night'))}
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
