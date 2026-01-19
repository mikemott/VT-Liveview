/**
 * StationDetail - Display weather station information
 */

import { MapPin, Thermometer, Wind, Droplets, Gauge } from 'lucide-react';
import type { ObservationStation } from '../../types';
import './DetailViews.css';

interface StationDetailProps {
  station: ObservationStation;
  isDark: boolean;
}

export default function StationDetail({ station, isDark }: StationDetailProps) {
  const { name, location, elevation, weather } = station;

  const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCoordinates = (lat: number, lng: number): string => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
  };

  return (
    <div className={`detail-view station-detail ${isDark ? 'dark' : ''}`}>
      {/* Station name */}
      <div className="station-name">{name}</div>

      {/* Location info */}
      <div className="station-location">
        <MapPin size={14} />
        <span>{formatCoordinates(location.lat, location.lng)}</span>
      </div>

      {elevation && (
        <div className="station-elevation">
          Elevation: {elevation.toLocaleString()} ft
        </div>
      )}

      {/* Current conditions */}
      <div className="station-conditions">
        {/* Temperature */}
        <div className="condition-card temperature-card">
          <div className="condition-icon">
            <Thermometer size={24} />
          </div>
          <div className="condition-info">
            <div className="condition-value">
              {weather.temperature}°{weather.temperatureUnit}
            </div>
            <div className="condition-label">Temperature</div>
          </div>
        </div>

        {/* Wind */}
        {weather.windSpeed && (
          <div className="condition-card">
            <div className="condition-icon">
              <Wind size={24} />
            </div>
            <div className="condition-info">
              <div className="condition-value">
                {weather.windSpeed}
                {weather.windDirection && ` ${weather.windDirection}`}
              </div>
              <div className="condition-label">Wind</div>
            </div>
          </div>
        )}

        {/* Humidity */}
        {weather.humidity !== null && (
          <div className="condition-card">
            <div className="condition-icon">
              <Droplets size={24} />
            </div>
            <div className="condition-info">
              <div className="condition-value">{Math.round(weather.humidity)}%</div>
              <div className="condition-label">Humidity</div>
            </div>
          </div>
        )}

        {/* Dewpoint */}
        {weather.dewpoint !== null && (
          <div className="condition-card">
            <div className="condition-icon">
              <Droplets size={24} />
            </div>
            <div className="condition-info">
              <div className="condition-value">{weather.dewpoint}°F</div>
              <div className="condition-label">Dewpoint</div>
            </div>
          </div>
        )}

        {/* Pressure */}
        {weather.pressure !== null && (
          <div className="condition-card">
            <div className="condition-icon">
              <Gauge size={24} />
            </div>
            <div className="condition-info">
              <div className="condition-value">{weather.pressure} mb</div>
              <div className="condition-label">Pressure</div>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="station-description">{weather.description}</div>

      {/* Last updated */}
      <div className="station-updated">
        Last updated: {formatTimestamp(weather.timestamp)}
      </div>
    </div>
  );
}
