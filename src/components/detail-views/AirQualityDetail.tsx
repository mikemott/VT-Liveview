/**
 * AirQualityDetail - an EPA AirNow air quality monitor (VTL-76)
 */
import type { AirQualityMonitor } from '../../services/airQualityApi';
import { useAirQuality } from '../../hooks/useAirQuality';
import { getObservationAge } from '../../utils/observationAge';
import {
  aqiCategory,
  aqiToneVars,
  isAirReadingStale,
  pollutantLabel,
  upcomingAirDays,
} from '../../utils/aqi';
import { isInVermont } from '../../utils/vermont';
import LayerBadge from './LayerBadge';
import AqiBadge, { AqiForecastList } from './AqiBadge';
import { DetailHeader, DetailRows } from './DetailParts';
import './DetailViews.css';

interface AirQualityDetailProps {
  monitor: AirQualityMonitor;
  isDark: boolean;
}

export default function AirQualityDetail({ monitor, isDark }: AirQualityDetailProps) {
  const category = aqiCategory(monitor.category);
  const age = getObservationAge(monitor.observedAt);
  const stale = isAirReadingStale(monitor.observedAt);
  const inVermont = isInVermont(monitor.lat, monitor.lng);
  // The forecast for the monitor's reporting area
  const { data: air } = useAirQuality(monitor.lat, monitor.lng);
  const days = upcomingAirDays(air?.forecast ?? []);
  const area = days[0]?.reportingArea;

  return (
    <div className={`detail-view air-quality-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="airQuality" label="Air quality monitor" />
      <DetailHeader name={monitor.name} location={monitor.agency} />

      <div className="aq-headline aqi-tone" role="status" style={aqiToneVars(monitor.category)}>
        <span className="aq-headline-value">{monitor.aqi}</span>
        <span className="aq-headline-text">
          <span className="aq-headline-label">AQI</span>
          <span className="aq-headline-name">{category.name}</span>
        </span>
      </div>
      <p className="detail-note">{category.advice}</p>

      <DetailRows
        rows={monitor.readings.map((r) => [
          pollutantLabel(r.pollutant),
          <span key={r.pollutant} className="aq-reading">
            <AqiBadge category={r.category} aqi={r.aqi} /> {aqiCategory(r.category).name}
          </span>,
        ])}
      />

      {age.ago && (
        <div className={`camera-caption${stale ? ' stale' : ''}`}>
          {stale ? '⚠️ Old reading: ' : 'Hourly reading, '}
          {age.ago} ({age.asOf})
        </div>
      )}

      {days.length > 0 && (
        <div className="detail-section">
          <div className="section-label">Forecast{area ? ` · ${area} area` : ''}</div>
          <AqiForecastList days={days} />
        </div>
      )}

      <div className="station-updated">
        {inVermont
          ? 'Vermont has only a few air quality monitors, so a reading here may differ from conditions in nearby valleys and towns.'
          : 'Just outside Vermont: shown because it is the closest monitor for nearby parts of the state.'}{' '}
        The AQI shown is the worst of the pollutants measured here. Source: EPA AirNow (preliminary
        data).
      </div>
    </div>
  );
}
