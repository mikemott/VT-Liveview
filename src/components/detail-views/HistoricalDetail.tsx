/**
 * HistoricalDetail - Display historical weather data
 */

import { MapPin, Thermometer, Cloud, Snowflake } from 'lucide-react';
import { useHistoricalData } from '../../hooks/useHistoricalData';
import './DetailViews.css';

interface HistoricalDetailProps {
  coordinates: { lat: number; lng: number };
  isDark: boolean;
}

export default function HistoricalDetail({ coordinates, isDark }: HistoricalDetailProps) {
  const { lat, lng } = coordinates;

  const { data, isLoading, error } = useHistoricalData({
    lat,
    lng,
    enabled: true,
  });

  const formatCoordinates = (latitude: number, longitude: number): string => {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lngDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lngDir}`;
  };

  // Parse date string as local date to avoid UTC timezone shifts
  const parseLocalDate = (dateStr: string): Date => {
    // Handle YYYY-MM-DD format (most common from NOAA)
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && match[1] && match[2] && match[3]) {
      const year = match[1];
      const month = match[2];
      const day = match[3];
      // Month is 0-indexed in JavaScript Date constructor
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Fallback for other formats (though this may still have UTC issues)
    return new Date(dateStr);
  };

  const formatDate = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDayName = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
    if (isNaN(date.getTime())) {
      return 'Invalid';
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = date.toDateString();
    const todayOnly = today.toDateString();
    const yesterdayOnly = yesterday.toDateString();

    if (dateOnly === todayOnly) {
      return 'Today';
    } else if (dateOnly === yesterdayOnly) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
  };

  if (isLoading) {
    return (
      <div className={`detail-view historical-detail ${isDark ? 'dark' : ''}`}>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <div>Loading historical data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`detail-view historical-detail ${isDark ? 'dark' : ''}`}>
        <div className="error-state">
          <div>Failed to load historical data</div>
          <div className="error-message">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.historicalData) {
    return (
      <div className={`detail-view historical-detail ${isDark ? 'dark' : ''}`}>
        <div className="error-state">
          <div>No data available</div>
        </div>
      </div>
    );
  }

  const { weather, stationName, stationDistance } = data.historicalData;

  return (
    <div className={`detail-view historical-detail ${isDark ? 'dark' : ''}`}>
      {/* Location header */}
      <div className="historical-location">
        <div className="location-icon">
          <MapPin size={16} />
        </div>
        <div className="location-details">
          <div className="location-coords">{formatCoordinates(lat, lng)}</div>
          <div className="location-station">
            Data from {stationName} ({stationDistance.toFixed(1)} mi away)
          </div>
        </div>
      </div>

      {/* Weather history */}
      <div className="historical-section">
        <h3 className="historical-section-title">Past 7 Days</h3>

        {weather.length === 0 ? (
          <div className="no-data">No weather data available for this location</div>
        ) : (
          weather.map((day) => (
            <div key={day.date} className="weather-day-card">
              <div className="day-header">
                <span className="day-date">{formatDate(day.date)}</span>
                <span className="day-name">{getDayName(day.date)}</span>
              </div>

              {/* Temperature */}
              {(day.tempMax !== null || day.tempMin !== null) && (
                <div className="weather-metric">
                  <div className="metric-icon">
                    <Thermometer size={16} />
                  </div>
                  <span className="metric-value">
                    {day.tempMax !== null ? `${day.tempMax}°F` : '--'} /{' '}
                    {day.tempMin !== null ? `${day.tempMin}°F` : '--'}
                  </span>
                </div>
              )}

              {/* Precipitation */}
              {day.precipitation !== null && day.precipitation > 0 && (
                <div className="weather-metric">
                  <div className="metric-icon">
                    <Cloud size={16} />
                  </div>
                  <span className="metric-value">{day.precipitation}" rain</span>
                </div>
              )}

              {/* Snowfall */}
              {day.snowfall !== null && day.snowfall > 0 && (
                <div className="weather-metric">
                  <div className="metric-icon">
                    <Snowflake size={16} />
                  </div>
                  <span className="metric-value">{day.snowfall}" snow</span>
                </div>
              )}

              {/* No data indicator */}
              {day.tempMax === null &&
                day.tempMin === null &&
                (day.precipitation === null || day.precipitation === 0) &&
                (day.snowfall === null || day.snowfall === 0) && (
                  <div className="no-data">No data recorded</div>
                )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
