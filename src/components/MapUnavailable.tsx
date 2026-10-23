import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, MonitorX, RefreshCw } from 'lucide-react';
import CurrentWeather from './CurrentWeather';
import { fetchMergedAlerts, type MergedAlertData } from '../services/graphqlClient';
import { fetchAllIncidents, type TravelIncident } from '../services/travelApi';
import { isDarkMode } from '../utils/mapStyles';
import { INTERVALS } from '../utils/constants';
import './MapUnavailable.css';

const INCIDENT_LABELS: Record<TravelIncident['type'], string> = {
  ACCIDENT: 'Accidents',
  CLOSURE: 'Road closures',
  CONSTRUCTION: 'Construction',
  FLOODING: 'Flooding',
  HAZARD: 'Hazards',
};

const INCIDENT_ORDER: TravelIncident['type'][] = [
  'CLOSURE',
  'ACCIDENT',
  'FLOODING',
  'HAZARD',
  'CONSTRUCTION',
];

interface MapUnavailableProps {
  /** Why the map couldn't start; only shown in development. */
  reason?: string;
}

/**
 * Text-only view shown when the map can't render (no WebGL).
 * Keeps the parts of the app that don't need a map: weather, alerts, incidents.
 */
export default function MapUnavailable({ reason }: MapUnavailableProps) {
  const isDark = isDarkMode();

  const alertsQuery = useQuery<MergedAlertData[]>({
    queryKey: ['fallback', 'alerts', 'VT'],
    queryFn: () => fetchMergedAlerts('VT'),
    refetchInterval: INTERVALS.INCIDENTS_REFRESH,
  });

  const incidentsQuery = useQuery<TravelIncident[]>({
    queryKey: ['fallback', 'incidents'],
    queryFn: fetchAllIncidents,
    refetchInterval: INTERVALS.INCIDENTS_REFRESH,
  });

  const incidentsByType = INCIDENT_ORDER.map((type) => ({
    type,
    items: (incidentsQuery.data ?? []).filter((i) => i.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <div className={`map-unavailable ${isDark ? 'dark' : ''}`}>
      <header className="map-unavailable-header">
        <img
          src={isDark ? '/assets/vt-liveview-dark.svg' : '/assets/vt-liveview-vintage.svg'}
          alt="VT LiveView"
          className="map-unavailable-logo"
        />
      </header>

      <main className="map-unavailable-main">
        <section className="map-unavailable-notice" role="status">
          <MonitorX size={28} aria-hidden="true" />
          <div>
            <h1>The map can't load in this browser</h1>
            <p>
              The interactive map needs WebGL, which is turned off or unavailable here. Turning on
              hardware acceleration in your browser settings, updating your browser, or trying
              another device usually fixes it. Current alerts and road incidents are listed below.
            </p>
            {import.meta.env.DEV && reason && <p className="map-unavailable-reason">{reason}</p>}
            <button
              type="button"
              className="map-unavailable-retry"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
          </div>
        </section>

        <section aria-labelledby="fallback-weather">
          <h2 id="fallback-weather">Weather · Montpelier</h2>
          <div className="map-unavailable-weather">
            <CurrentWeather isDark={isDark} />
          </div>
        </section>

        <section aria-labelledby="fallback-alerts">
          <h2 id="fallback-alerts">Weather alerts</h2>
          {alertsQuery.isLoading && <p className="map-unavailable-muted">Loading alerts…</p>}
          {alertsQuery.isError && (
            <p className="map-unavailable-muted">Couldn't load alerts right now.</p>
          )}
          {alertsQuery.data && alertsQuery.data.length === 0 && (
            <p className="map-unavailable-muted">No active weather alerts for Vermont.</p>
          )}
          <ul className="map-unavailable-list">
            {alertsQuery.data?.map((alert) => (
              <li
                key={alert.id}
                className={`map-unavailable-alert severity-${alert.severity?.toLowerCase()}`}
              >
                <AlertTriangle size={16} aria-hidden="true" />
                <div>
                  <strong>{alert.event}</strong>
                  <span>{alert.headline || alert.areaDesc}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="fallback-incidents">
          <h2 id="fallback-incidents">Roads &amp; travel</h2>
          {incidentsQuery.isLoading && <p className="map-unavailable-muted">Loading incidents…</p>}
          {incidentsQuery.isError && (
            <p className="map-unavailable-muted">Couldn't load travel incidents right now.</p>
          )}
          {incidentsQuery.data && incidentsQuery.data.length === 0 && (
            <p className="map-unavailable-muted">No travel incidents reported.</p>
          )}
          {incidentsByType.map((group) => (
            <div key={group.type} className="map-unavailable-group">
              <h3>
                {INCIDENT_LABELS[group.type]} ({group.items.length})
              </h3>
              <ul className="map-unavailable-list">
                {group.items.map((incident) => (
                  <li key={incident.id} className="map-unavailable-incident">
                    <div>
                      <strong>{incident.roadName || incident.title}</strong>
                      <span>{incident.description || incident.title}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
