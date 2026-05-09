/**
 * LocationDetail - Comprehensive location information panel
 * Shows forecast, astronomy data, and historical comparison when clicking on map
 */

import {
  MapPin,
  Thermometer,
  Cloud,
  Sunrise,
  Sunset,
  Moon,
  Clock,
  Sun
} from 'lucide-react';
import { useForecast } from '../../hooks/useForecast';
import { calculateSunTimes, calculateMoonPhase } from '../../utils/astronomy';
import './DetailViews.css';

interface LocationDetailProps {
  coordinates: { lat: number; lng: number };
  isDark: boolean;
}

export default function LocationDetail({ coordinates, isDark }: LocationDetailProps) {
  const { lat, lng } = coordinates;

  // Fetch forecast data
  const { data: forecastData, isLoading: forecastLoading, error: forecastError } = useForecast({
    lat,
    lng,
    enabled: true,
  });

  // Calculate astronomy data
  const sunTimes = calculateSunTimes(lat, lng);
  const moonPhase = calculateMoonPhase();

  const formatCoordinates = (latitude: number, longitude: number): string => {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lngDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lngDir}`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get next 12 hours of forecast (6 periods typically)
  const upcomingForecast = forecastData?.forecast?.slice(0, 6) || [];

  // Calculate golden hour times
  const morningGoldenHourEnd = new Date(sunTimes.sunrise.getTime() + 60 * 60 * 1000); // 1 hour after sunrise
  const eveningGoldenHourStart = new Date(sunTimes.sunset.getTime() - 60 * 60 * 1000); // 1 hour before sunset

  return (
    <div className={`detail-view location-detail ${isDark ? 'dark' : ''}`}>
      {/* Location header */}
      <div className="location-header">
        <div className="location-icon">
          <MapPin size={16} />
        </div>
        <div className="location-coords">{formatCoordinates(lat, lng)}</div>
      </div>

      {/* Section 1: Current Forecast */}
      <div className="location-section">
        <h3 className="section-title">
          <Cloud size={14} />
          Forecast
        </h3>

        {forecastLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <div>Loading forecast...</div>
          </div>
        )}

        {forecastError && (
          <div className="error-state">
            <div className="error-message">Unable to load forecast</div>
          </div>
        )}

        {!forecastLoading && !forecastError && upcomingForecast.length > 0 && (
          <div className="forecast-periods">
            {upcomingForecast.map((period) => (
              <div key={period.number} className="forecast-period">
                <div className="period-name">{period.name}</div>
                <div className="period-temp">
                  <Thermometer size={14} />
                  {period.temperature}°{period.temperatureUnit}
                </div>
                <div className="period-conditions">{period.shortForecast}</div>
                {period.probabilityOfPrecipitation?.value && period.probabilityOfPrecipitation.value > 0 && (
                  <div className="period-precip">
                    <Cloud size={12} />
                    {period.probabilityOfPrecipitation.value}% chance
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!forecastLoading && !forecastError && upcomingForecast.length === 0 && (
          <div className="no-data">No forecast data available</div>
        )}
      </div>

      {/* Section 2: Astronomy */}
      <div className="location-section">
        <h3 className="section-title">
          <Sunrise size={14} />
          Astronomy
        </h3>

        <div className="astronomy-grid">
          <div className="astro-item">
            <div className="astro-label">
              <Sunrise size={14} />
              Sunrise
            </div>
            <div className="astro-value">{formatTime(sunTimes.sunrise)}</div>
          </div>

          <div className="astro-item">
            <div className="astro-label">
              <Sunset size={14} />
              Sunset
            </div>
            <div className="astro-value">{formatTime(sunTimes.sunset)}</div>
          </div>

          <div className="astro-item">
            <div className="astro-label">
              <Sun size={14} />
              Morning Golden Hour
            </div>
            <div className="astro-value">{formatTime(sunTimes.sunrise)} - {formatTime(morningGoldenHourEnd)}</div>
          </div>

          <div className="astro-item">
            <div className="astro-label">
              <Sun size={14} />
              Evening Golden Hour
            </div>
            <div className="astro-value">{formatTime(eveningGoldenHourStart)} - {formatTime(sunTimes.sunset)}</div>
          </div>

          <div className="astro-item">
            <div className="astro-label">
              <Clock size={14} />
              Astronomical Twilight
            </div>
            <div className="astro-value">{formatTime(sunTimes.astronomicalTwilight)}</div>
          </div>

          <div className="astro-item">
            <div className="astro-label">
              <Moon size={14} />
              Moon Phase
            </div>
            <div className="astro-value">
              {moonPhase.phaseName}
              <span className="moon-illumination"> ({moonPhase.illumination}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
