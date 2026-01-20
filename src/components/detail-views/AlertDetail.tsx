/**
 * AlertDetail - Display weather alert information
 */

import { AlertTriangle } from 'lucide-react';
import type { AlertFeature } from '../../types';
import './DetailViews.css';

interface AlertDetailProps {
  alert: AlertFeature;
  isDark: boolean;
}

export default function AlertDetail({ alert, isDark }: AlertDetailProps) {
  const { event, headline, severity, areaDesc, description, instruction, effective, expires } =
    alert.properties;

  const getSeverityColor = (sev?: string): string => {
    switch (sev) {
      case 'Extreme':
        return '#d00000';
      case 'Severe':
        return '#ff6d00';
      case 'Moderate':
        return '#ffba08';
      case 'Minor':
        return '#3b82f6';
      default:
        return '#8b8b8b';
    }
  };

  const formatDate = (isoString?: string): string => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`detail-view alert-detail ${isDark ? 'dark' : ''}`}>
      {/* Severity badge */}
      <div className="alert-severity" style={{ borderColor: getSeverityColor(severity) }}>
        <AlertTriangle
          size={18}
          style={{ color: getSeverityColor(severity) }}
        />
        <span style={{ color: getSeverityColor(severity) }}>{severity || 'Alert'}</span>
      </div>

      {/* Event type */}
      <div className="alert-event">{event}</div>

      {/* Headline */}
      {headline && <div className="alert-headline">{headline}</div>}

      {/* Area affected */}
      <div className="alert-section">
        <div className="section-label">Areas Affected</div>
        <div className="section-value">{areaDesc}</div>
      </div>

      {/* Description */}
      {description && (
        <div className="alert-section">
          <div className="section-label">Description</div>
          <div className="section-value alert-description">{description}</div>
        </div>
      )}

      {/* Instructions */}
      {instruction && (
        <div className="alert-section">
          <div className="section-label">Instructions</div>
          <div className="section-value alert-instruction">{instruction}</div>
        </div>
      )}

      {/* Timing */}
      <div className="alert-timing">
        <div className="timing-row">
          <span className="timing-label">Effective:</span>
          <span className="timing-value">{formatDate(effective)}</span>
        </div>
        <div className="timing-row">
          <span className="timing-label">Expires:</span>
          <span className="timing-value">{formatDate(expires)}</span>
        </div>
      </div>
    </div>
  );
}
