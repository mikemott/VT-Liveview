/**
 * IncidentDetail - Display traffic incident information
 */

import { AlertCircle, Construction, X, Droplets, AlertTriangle as Hazard } from 'lucide-react';
import type { Incident } from '../../types';
import { getIncidentColor } from '../../utils/incidentColors';
import './DetailViews.css';

interface IncidentDetailProps {
  incident: Incident;
  isDark: boolean;
}

export default function IncidentDetail({ incident, isDark }: IncidentDetailProps) {
  const colors = getIncidentColor(incident.type);

  const getIcon = () => {
    const iconProps = { size: 20, style: { color: colors.primary } };

    switch (incident.type) {
      case 'ACCIDENT':
        return <AlertCircle {...iconProps} />;
      case 'CONSTRUCTION':
        return <Construction {...iconProps} />;
      case 'CLOSURE':
        return <X {...iconProps} />;
      case 'FLOODING':
        return <Droplets {...iconProps} />;
      case 'HAZARD':
        return <Hazard {...iconProps} />;
      default:
        return <AlertCircle {...iconProps} />;
    }
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const getSeverityLabel = (severity: string): string => {
    return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
  };

  return (
    <div className={`detail-view incident-detail ${isDark ? 'dark' : ''}`}>
      {/* Type badge */}
      <div
        className="incident-type-badge"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.primary,
        }}
      >
        {getIcon()}
        <span style={{ color: colors.primary }}>{colors.name}</span>
      </div>

      {/* Title */}
      <div className="incident-title">{incident.title}</div>

      {/* Severity */}
      <div className="incident-severity-label">
        Severity: {getSeverityLabel(incident.severity)}
      </div>

      {/* Location */}
      {incident.road && (
        <div className="incident-section">
          <div className="section-label">Location</div>
          <div className="section-value">
            {incident.road}
            {incident.direction && ` (${incident.direction})`}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="incident-section">
        <div className="section-label">Description</div>
        <div className="section-value incident-description">{incident.description}</div>
      </div>

      {/* Timing */}
      <div className="incident-timing">
        {incident.startTime && (
          <div className="timing-row">
            <span className="timing-label">Started:</span>
            <span className="timing-value">{formatDate(incident.startTime)}</span>
          </div>
        )}
        {incident.endTime && (
          <div className="timing-row">
            <span className="timing-label">Expected End:</span>
            <span className="timing-value">{formatDate(incident.endTime)}</span>
          </div>
        )}
        <div className="timing-row">
          <span className="timing-label">Last Updated:</span>
          <span className="timing-value">{formatDate(incident.lastUpdated)}</span>
        </div>
      </div>

      {/* Source */}
      <div className="incident-source">
        Source: {incident.source}
      </div>
    </div>
  );
}
