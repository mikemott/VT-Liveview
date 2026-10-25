/**
 * RoadWeatherDetail - a VTrans road weather station (VTL-61)
 */
import { MapPin } from 'lucide-react';
import type { RoadWeatherStation } from '../../services/roadWeatherApi';
import { getObservationAge } from '../../utils/observationAge';
import { cToF, describeFriction, getRoadRisk, ROAD_RISK_LABELS } from '../../utils/roadWeather';
import LayerBadge from './LayerBadge';
import './DetailViews.css';

interface RoadWeatherDetailProps {
  station: RoadWeatherStation;
  isDark: boolean;
}

const fmtTemp = (c: number | null): string => (c === null ? '—' : `${cToF(c)}°F`);

export default function RoadWeatherDetail({ station, isDark }: RoadWeatherDetailProps) {
  const risk = getRoadRisk(station);
  const age = getObservationAge(station.observedAt);
  const where = [station.roadway, station.direction && `${station.direction}bound`]
    .filter(Boolean)
    .join(' · ');

  const rows: [string, string][] = [
    ['Air', fmtTemp(station.airTempC)],
    ['Dew point', fmtTemp(station.dewPointC)],
    ['Surface', station.surface ?? 'Not reported'],
    [
      'Friction',
      station.friction === null
        ? 'Not reported'
        : `${station.friction.toFixed(2)} (${describeFriction(station.friction)})`,
    ],
    ['Precipitation', station.precip ?? 'Not reported'],
  ];

  return (
    <div className={`detail-view road-weather-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="roadWeather" label="Road weather station" />
      <div className="station-name">{station.name}</div>
      {(where || station.location) && (
        <div className="station-location">
          <MapPin size={14} />
          <span>{[where, station.location].filter(Boolean).join(' — ')}</span>
        </div>
      )}

      <div className={`road-weather-headline risk-${risk}`} role="status">
        <div className="road-weather-pavement">
          <span className="road-weather-pavement-value">{fmtTemp(station.pavementTempC)}</span>
          <span className="road-weather-pavement-label">pavement</span>
        </div>
        <div className="road-weather-risk">{ROAD_RISK_LABELS[risk]}</div>
      </div>

      <dl className="detail-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="detail-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {age.ago && (
        <div className={`camera-caption${age.isStale ? ' stale' : ''}`}>
          {age.isStale ? '⚠️ Old reading: ' : 'Reading '}
          {age.ago} ({age.asOf})
        </div>
      )}

      <div className="station-updated">
        Source: VTrans road weather information system (RWIS). Pavement temperature is measured at
        this spot only; bridges and shaded curves can be colder.
      </div>
    </div>
  );
}
