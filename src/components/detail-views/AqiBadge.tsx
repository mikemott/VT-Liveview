/**
 * Air quality pieces shared by What's here (VTL-75) and the monitor panel (VTL-76).
 */
import type { AirQualityForecastDay } from '../../services/airQualityApi';
import { aqiCategory, aqiShortName, aqiToneVars, dayLabel } from '../../utils/aqi';
import '../../styles/aqi.css';
import './DetailViews.css';

/** AQI value (or category name) in its category's tone */
export default function AqiBadge({ category, aqi }: { category: number; aqi: number | null }) {
  const c = aqiCategory(category);
  return (
    <span className="aqi-badge aqi-tone" style={aqiToneVars(category)}>
      {aqi !== null ? `AQI ${aqi}` : c.name}
    </span>
  );
}

/** A few days of AirNow forecast, one row each */
export function AqiForecastList({ days }: { days: readonly AirQualityForecastDay[] }) {
  if (days.length === 0) return null;
  return (
    <ul className="location-aqi-forecast" aria-label="Air quality forecast">
      {days.map((d) => (
        <li key={d.date}>
          <span className="location-forecast-name">{dayLabel(d.date)}</span>
          <AqiBadge category={d.category} aqi={d.aqi} />
          <span className="location-forecast-text">
            {/* A category-only forecast already names it in the badge */}
            {d.aqi !== null ? aqiShortName(d.category) : ''}
            {d.actionDay ? `${d.aqi !== null ? ' · ' : ''}Air quality action day` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
