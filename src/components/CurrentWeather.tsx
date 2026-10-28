import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCurrentWeather,
  fetchForecast,
  type CurrentWeatherData,
  type ForecastPeriodData,
} from '../services/graphqlClient';
import { Wind, Droplets, ChevronDown } from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import { getWeatherIconName, getWeatherIconFromNOAAUrl } from '../utils/weatherIconMapping';
import { isCurrentlyDaytime } from '../utils/time';
import { useAirQuality } from '../hooks/useAirQuality';
import { aqiShortName, aqiToneVars, pollutantLabel } from '../utils/aqi';
import { useClimateToday } from '../hooks/useClimateToday';
import { compareWithNormal } from '../utils/climate';
import '../styles/aqi.css';
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

export default function CurrentWeather({
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
  isDark = false,
  isMobile = false,
}: CurrentWeatherProps) {
  // Default to collapsed for better map visibility
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading } = useQuery<CurrentWeatherData | null>({
    queryKey: ['currentWeather', lat, lon],
    queryFn: () => fetchCurrentWeather(lat, lon),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch to prevent flashing
  });

  const { data: forecastData } = useQuery<ForecastPeriodData[] | null>({
    queryKey: ['forecast', lat, lon],
    queryFn: () => fetchForecast(lat, lon),
    staleTime: 15 * 60 * 1000, // 15 minutes (forecast changes less often)
    refetchInterval: 15 * 60 * 1000,
    retry: 2,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
  });

  // Air quality is a bonus line: if it fails or isn't configured, it just doesn't show
  const { data: air } = useAirQuality(lat, lon);
  const aqNow = air?.current ?? null;

  // Normals and records (VTL-81): also a bonus, hidden if unavailable
  const { data: climate } = useClimateToday(lat, lon);

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

  // Never present made-up readings as live conditions: if the request failed
  // or returned nothing, say so.
  if (!data) {
    return (
      <div className={`current-weather error ${isDark ? 'dark' : ''}`} role="status">
        Weather unavailable right now
      </div>
    );
  }
  const weatherData = data;

  // 3-day forecast = 6 periods (day/night). Omitted entirely if unavailable.
  const forecast = forecastData?.slice(0, 6) ?? [];
  const vsNormal = compareWithNormal(forecast[0], climate);
  const hasNormals = climate && (climate.normalHighF !== null || climate.recordHigh !== null);

  // Mobile collapsed: ultra-minimal view (just temp + icon)
  const showMinimalView = isMobile && !isExpanded;

  return (
    // TODO(VTL-45 Phase 4): expandable card needs keyboard support (see docs/review/FINDINGS.md, a11y)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
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
                  <span>
                    {weatherData.windSpeed} {weatherData.windDirection}
                  </span>
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
      {!showMinimalView && <div className="weather-description">{weatherData.description}</div>}

      {/* Air quality (VTL-75): nearest AirNow monitor */}
      {!showMinimalView && aqNow && (
        <div
          className="weather-aqi"
          title={`${pollutantLabel(aqNow.pollutant)} at the ${aqNow.name} monitor, ${Math.round(aqNow.distanceMi)} mi away (EPA AirNow)`}
        >
          <span className="weather-aqi-badge aqi-tone" style={aqiToneVars(aqNow.category)}>
            AQI {aqNow.aqi}
          </span>
          <span className="weather-aqi-label">{aqiShortName(aqNow.category)}</span>
        </div>
      )}

      {/* Today's forecast high (or tonight's low) against the normal (VTL-81) */}
      {!showMinimalView && vsNormal && (
        <div
          className="weather-normal"
          title={`Normal ${vsNormal.kind} for today: ${vsNormal.normalF}° (${climate?.station.name}, 1991–2020)`}
        >
          {vsNormal.kind === 'high' ? 'High' : 'Low tonight'} {vsNormal.forecastF}°,{' '}
          <span
            className={`weather-normal-diff ${
              vsNormal.text === 'near normal' ? '' : vsNormal.diffF > 0 ? 'warm' : 'cold'
            }`}
          >
            {vsNormal.text}
          </span>
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
                      <WeatherIcon name={getWeatherIconFromNOAAUrl(period.icon)} size={48} />
                    </div>
                    <div className="forecast-temperature">{Math.round(period.temperature)}°</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasNormals && (
            <div className="climate-section">
              <div className="forecast-title">Today in {climate.station.name}</div>
              <dl className="climate-rows">
                {climate.normalHighF !== null && climate.normalLowF !== null && (
                  <div>
                    <dt>Normal</dt>
                    <dd>
                      {climate.normalHighF}° / {climate.normalLowF}°
                    </dd>
                  </div>
                )}
                {climate.recordHigh && (
                  <div>
                    <dt>Record high</dt>
                    <dd>
                      {climate.recordHigh.tempF}° ({climate.recordHigh.year})
                    </dd>
                  </div>
                )}
                {climate.recordLow && (
                  <div>
                    <dt>Record low</dt>
                    <dd>
                      {climate.recordLow.tempF}° ({climate.recordLow.year})
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {data?.stationName && <div className="station-name">{data.stationName}</div>}
        </>
      )}

      <div className={`expand-indicator ${isExpanded ? 'expanded' : ''}`}>
        <ChevronDown size={20} />
      </div>
    </div>
  );
}
