/**
 * LocationDetail - "What's here?" for a point on the map (VTL-65)
 *
 * Answers "what's it like there?": the town it's in, alerts covering it, the
 * forecast for that spot, the nearest road temperature and camera, closures
 * and accidents close by, and sunrise/sunset.
 */
import { AlertTriangle, Sunrise, Sunset } from 'lucide-react';
import { useForecast } from '../../hooks/useForecast';
import { calculateSunTimes } from '../../utils/astronomy';
import { nearestTown } from '../../utils/geo';
import { formatMiles } from '../../utils/locationContext';
import { cToF } from '../../utils/roadWeather';
import { LAYER_STYLES, layerColorVars, type LayerStyleKey } from '../../config/layers';
import type { DetailPanelContent, LocationContext, NearbyItem } from '../../types/detailPanel';
import { DetailHeader, DetailSource } from './DetailParts';
import './DetailViews.css';

interface LocationDetailProps {
  coordinates: { lat: number; lng: number };
  context?: LocationContext | undefined;
  /** Open an alert or nearby item in the panel */
  onOpen?: ((content: DetailPanelContent) => void) | undefined;
  isDark: boolean;
}

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function describeNearby(item: NearbyItem): {
  layer: LayerStyleKey;
  title: string;
  detail: string;
  content: DetailPanelContent;
} {
  switch (item.kind) {
    case 'roadWeather': {
      const s = item.data;
      const temp =
        s.pavementTempC !== null
          ? `Pavement ${cToF(s.pavementTempC)}°F`
          : s.airTempC !== null
            ? `Air ${cToF(s.airTempC)}°F`
            : 'No reading';
      return {
        layer: 'roadWeather',
        title: temp + (s.surface ? ` · ${s.surface}` : ''),
        detail: s.name,
        content: { type: 'roadWeather', data: s },
      };
    }
    case 'camera':
      return {
        layer: 'trafficCameras',
        title: 'Traffic camera',
        detail: item.data.name,
        content: { type: 'camera', data: item.data },
      };
    case 'incident':
      return {
        layer: item.data.type,
        title: item.data.title,
        detail: item.data.roadName || LAYER_STYLES[item.data.type].label,
        content: { type: 'incident', data: item.data },
      };
  }
}

export default function LocationDetail({
  coordinates,
  context,
  onOpen,
  isDark,
}: LocationDetailProps) {
  const { lat, lng } = coordinates;
  const town = nearestTown(lat, lng);
  const { data, isLoading, error } = useForecast({ lat, lng, enabled: true });
  const periods = data?.forecast?.slice(0, 4) ?? [];
  const sun = calculateSunTimes(lat, lng);
  const coords = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;

  return (
    <div className={`detail-view location-detail ${isDark ? 'dark' : ''}`}>
      <DetailHeader
        name={town ? `Near ${town.name}` : 'This spot'}
        location={town ? `${town.county} County · ${coords}` : coords}
      />

      {context && context.alerts.length > 0 && (
        <ul className="location-alerts">
          {context.alerts.map((alert, i) => (
            <li key={alert.properties.id ?? i}>
              <button
                type="button"
                className="location-alert"
                onClick={() => onOpen?.({ type: 'alert', data: alert })}
              >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{alert.properties.event}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="detail-section">
        <div className="section-label">Forecast</div>
        {isLoading && <p className="detail-note">Loading forecast…</p>}
        {error && !isLoading && (
          <p className="detail-note">Couldn't load the forecast for this spot right now.</p>
        )}
        {periods.length > 0 && (
          <ul className="location-forecast">
            {periods.map((p) => (
              <li key={p.startTime}>
                <span className="location-forecast-name">{p.name}</span>
                <span className="location-forecast-temp">
                  {p.temperature}°{p.temperatureUnit}
                </span>
                <span className="location-forecast-text">
                  {p.shortForecast}
                  {p.precipChance ? ` · ${p.precipChance}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {context && context.nearby.length > 0 && (
        <div className="detail-section">
          <div className="section-label">Nearby</div>
          <ul className="location-nearby">
            {context.nearby.map((item) => {
              const { layer, title, detail, content } = describeNearby(item);
              const Icon = LAYER_STYLES[layer].icon;
              return (
                <li key={`${item.kind}:${item.data.id}`}>
                  <button
                    type="button"
                    className="location-nearby-item"
                    style={layerColorVars(layer)}
                    onClick={() => onOpen?.(content)}
                  >
                    <Icon size={16} aria-hidden="true" className="location-nearby-icon" />
                    <span className="location-nearby-text">
                      <span className="location-nearby-title">{title}</span>
                      <span className="location-nearby-detail">{detail}</span>
                    </span>
                    <span className="location-nearby-distance">{formatMiles(item.distanceMi)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="location-sun">
        <Sunrise size={14} aria-hidden="true" /> {formatTime(sun.sunrise)}
        <Sunset size={14} aria-hidden="true" /> {formatTime(sun.sunset)}
      </div>

      <DetailSource>Forecast: National Weather Service</DetailSource>
    </div>
  );
}
