/**
 * Active NWS alerts as a popup on the map (VTL-85). It shows the most severe
 * alert (or the selected one), with the rest a click away. Choosing an alert
 * shades and zooms to its area, leaving the map in view; "Details" opens it in
 * the side panel. The popup can be minimized to a small pill.
 */
import { memo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  PanelRightOpen,
  X,
} from 'lucide-react';
import type { AlertFeature } from '../types';
import { alertKey } from '../utils/alerts';
import { formatDateTime } from '../utils/formatDateTime';
import './AlertPopup.css';

interface AlertPopupProps {
  /** Most severe first (sortAlerts) */
  alerts: AlertFeature[];
  isDark: boolean;
  /** Key of the alert whose area is shaded, if any */
  selectedKey: string | null;
  /** Shade and zoom to an alert (again to clear it) */
  onSelect: (alert: AlertFeature) => void;
  onDetails: (alert: AlertFeature) => void;
  onDismiss: (alert: AlertFeature) => void;
}

function SeverityIcon({ severity }: { severity: string | undefined }) {
  if (severity === 'Extreme' || severity === 'Severe') {
    return <AlertTriangle size={16} strokeWidth={2.5} />;
  }
  if (severity === 'Moderate') return <AlertCircle size={16} strokeWidth={2.5} />;
  return <Info size={16} strokeWidth={2.5} />;
}

/** "Until Jan 16, 10:00 AM · Western Chittenden; Lamoille" (the area may be cut short) */
function summary(alert: AlertFeature): string {
  const until = formatDateTime(alert.properties.expires);
  return [until && `Until ${until}`, alert.properties.areaDesc].filter(Boolean).join(' · ');
}

function AlertPopup({
  alerts,
  isDark,
  selectedKey,
  onSelect,
  onDetails,
  onDismiss,
}: AlertPopupProps) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  if (alerts.length === 0) return null;

  const top = alerts[0]!;
  const count = alerts.length;
  const theme = isDark ? 'dark' : '';

  if (minimized) {
    return (
      <div className="alert-popup-anchor">
        <button
          type="button"
          className={`alert-popup-pill severity-${top.properties.severity?.toLowerCase() ?? 'unknown'} ${theme}`}
          onClick={() => setMinimized(false)}
          aria-label={`Show ${count === 1 ? 'the weather alert' : `${count} weather alerts`}`}
        >
          <SeverityIcon severity={top.properties.severity} />
          <span>{count === 1 ? top.properties.event : `${count} weather alerts`}</span>
        </button>
      </div>
    );
  }

  const selected = alerts.find((a) => alertKey(a) === selectedKey);
  const shown = expanded ? alerts : [selected ?? top];
  return (
    <div className="alert-popup-anchor">
      <section className={`alert-popup ${theme}`} aria-labelledby="alert-popup-title">
        <div className="alert-popup-header">
          <h2 id="alert-popup-title">Active Alerts ({count})</h2>
          <button
            type="button"
            className="alert-popup-minimize"
            onClick={() => setMinimized(true)}
            aria-label="Minimize weather alerts"
          >
            <ChevronUp size={16} />
          </button>
        </div>
        <div className="alerts-list">
          {shown.map((alert) => {
            const key = alertKey(alert);
            const { event } = alert.properties;
            const text = summary(alert);
            return (
              <div
                key={key}
                className={`alert-card severity-${alert.properties.severity?.toLowerCase()} ${theme} ${key === selectedKey ? 'selected' : ''}`}
              >
                {/* Sibling buttons: a button nested inside a role="button" card is
                    unreachable for assistive tech (FINDINGS H16) */}
                <button
                  type="button"
                  className="alert-select"
                  onClick={() => onSelect(alert)}
                  aria-pressed={key === selectedKey}
                >
                  {/* The visible text stays in the accessible name (WCAG 2.5.3) */}
                  <span className="sr-only">Show the area of </span>
                  <span className="alert-icon-container">
                    <SeverityIcon severity={alert.properties.severity} />
                  </span>
                  <span className="alert-body">
                    <span className="alert-event">{event}</span>
                    <span className="alert-headline" title={text}>
                      {text}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="alert-dismiss"
                  onClick={() => onDetails(alert)}
                  aria-label={`Details for ${event}`}
                  title="Details"
                >
                  <PanelRightOpen size={14} />
                </button>
                <button
                  type="button"
                  className="alert-dismiss"
                  onClick={() => onDismiss(alert)}
                  aria-label={`Dismiss ${event} alert`}
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
        {count > 1 && (
          <button
            type="button"
            className="alert-popup-more"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Show fewer' : `${count - 1} more alert${count > 2 ? 's' : ''}`}
          </button>
        )}
      </section>
    </div>
  );
}

export default memo(AlertPopup);
