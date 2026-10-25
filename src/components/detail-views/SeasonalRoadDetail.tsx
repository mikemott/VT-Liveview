/**
 * SeasonalRoadDetail - a notch, gap or toll road that closes for winter (VTL-55)
 */
import { Ban, CalendarClock, ExternalLink, MapPin, Snowflake, Sun } from 'lucide-react';
import type { SeasonalRoad } from '../../data/seasonalRoads';
import { formatMonthDay, type RoadStatus } from '../../utils/seasonalRoads';
import { layerColorVars } from '../../config/layers';
import LayerBadge from './LayerBadge';
import './DetailViews.css';

interface SeasonalRoadDetailProps {
  road: SeasonalRoad;
  status: RoadStatus;
  isDark: boolean;
}

const STATUS_ICON = {
  closed511: Ban,
  seasonal: Snowflake,
  closingSoon: CalendarClock,
  open: Sun,
} as const;

export default function SeasonalRoadDetail({ road, status, isDark }: SeasonalRoadDetailProps) {
  const Icon = STATUS_ICON[status.status];
  return (
    <div className={`detail-view seasonal-road-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="seasonalRoads" label="Seasonal road" />
      <div className="station-name">{road.name}</div>
      <div className="station-location">
        <MapPin size={14} />
        <span>Between {road.between}</span>
      </div>

      <div
        className={`seasonal-status seasonal-status-${status.status}`}
        role="status"
        style={layerColorVars('seasonalRoads')}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{status.label}</span>
      </div>

      <div className="detail-section">
        <div className="section-label">Typical winter closure</div>
        <div className="section-value">
          {`${formatMonthDay(road.season.start)} – ${formatMonthDay(road.season.end)} (${road.seasonText})`}
        </div>
        <p className="seasonal-caveat">
          Dates change every year with the weather. Check with {road.owner} or Vermont 511 before
          you go, and don't trust GPS routing over these roads in winter.
        </p>
      </div>

      {road.note && (
        <div className="detail-section">
          <div className="section-label">About this road</div>
          <div className="seasonal-note">{road.note}</div>
        </div>
      )}

      <div className="detail-section">
        <div className="section-label">Sources</div>
        <ul className="seasonal-sources">
          {road.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="station-updated">
        Road line: VCGI / VTrans centerlines (approximate extent)
      </div>
    </div>
  );
}
