/**
 * IncidentDetail - a VT 511 report or USGS flood gauge, in the side panel (VTL-64)
 */
import { MapPin } from 'lucide-react';
import type { TravelIncident } from '../../services/travelApi';
import type { IncidentType } from '../../types';
import LayerBadge from './LayerBadge';
import './DetailViews.css';

interface IncidentDetailProps {
  incident: TravelIncident;
  isDark: boolean;
}

/** Singular names for the badge */
const TYPE_LABEL: Record<IncidentType, string> = {
  ACCIDENT: 'Accident',
  CONSTRUCTION: 'Construction',
  CLOSURE: 'Road closure',
  FLOODING: 'Flooding',
  HAZARD: 'Hazard',
};

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function IncidentDetail({ incident, isDark }: IncidentDetailProps) {
  const lanes = 'affectedLanes' in incident ? incident.affectedLanes : null;
  const restrictions = 'roadRestrictions' in incident ? incident.roadRestrictions : undefined;
  const since = formatWhen(incident.startTime);
  const description =
    incident.description && incident.description.trim() !== incident.title.trim()
      ? incident.description
      : null;

  return (
    <div className={`detail-view incident-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer={incident.type} label={TYPE_LABEL[incident.type]} />
      <div className="station-name">{incident.title}</div>
      {incident.roadName && (
        <div className="station-location">
          <MapPin size={14} />
          <span>{incident.roadName}</span>
        </div>
      )}

      {description && <p className="incident-description">{description}</p>}

      <dl className="detail-rows">
        {lanes && (
          <div className="detail-row">
            <dt>Lanes</dt>
            <dd>{lanes}</dd>
          </div>
        )}
        {restrictions?.weight && (
          <div className="detail-row">
            <dt>Weight limit</dt>
            {/* 511 sends bare pounds ("72000") */}
            <dd>
              {/^\d+$/.test(restrictions.weight)
                ? `${Number(restrictions.weight).toLocaleString()} lbs`
                : restrictions.weight}
            </dd>
          </div>
        )}
        {restrictions?.width && (
          <div className="detail-row">
            <dt>Width limit</dt>
            <dd>{restrictions.width}</dd>
          </div>
        )}
        {since && (
          <div className="detail-row">
            <dt>Since</dt>
            <dd>{since}</dd>
          </div>
        )}
      </dl>

      <div className="station-updated">Source: {incident.source}</div>
    </div>
  );
}
