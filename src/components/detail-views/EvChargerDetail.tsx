/**
 * EvChargerDetail - a public EV charging station from the DOE AFDC (VTL-81)
 */
import { ExternalLink } from 'lucide-react';
import type { EvCharger } from '../../services/evChargerApi';
import { describePorts } from '../../utils/evChargers';
import { afdcStationUrl, safeHttpsUrl } from '../../utils/sourceLinks';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailRows, DetailSource, DetailTags } from './DetailParts';
import './DetailViews.css';

interface EvChargerDetailProps {
  station: EvCharger;
  isDark: boolean;
}

const fmtDate = (date: string): string =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function EvChargerDetail({ station, isDark }: EvChargerDetailProps) {
  const where = [station.address, station.city].filter(Boolean).join(', ');
  // From upstream: link it only if it's https
  const networkUrl = safeHttpsUrl(station.networkUrl);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;

  return (
    <div className={`detail-view ev-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge
        layer="evChargers"
        label={station.dcFastPorts > 0 ? 'DC fast charger' : 'Level 2 charger'}
      />
      <DetailHeader name={station.name} location={where || null} />

      <DetailRows
        rows={[
          ['Chargers', describePorts(station)],
          ['Network', station.network ?? 'Not networked'],
          ['Hours', station.hours],
          ['Cost', station.pricing],
          ['Location type', station.facility],
        ]}
      />
      <DetailTags label="Connectors" tags={station.connectors} />

      <p className="detail-links">
        <a className="detail-link" href={directions} target="_blank" rel="noopener noreferrer">
          Directions <ExternalLink size={13} aria-hidden="true" />
        </a>
        {networkUrl && (
          <a className="detail-link" href={networkUrl} target="_blank" rel="noopener noreferrer">
            {station.network ?? 'Network'} availability{' '}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </p>

      <p className="detail-note">
        This doesn’t show whether a charger is in use or out of order; check the network’s app.
      </p>

      <DetailSource
        sources={[
          { name: 'U.S. DOE Alternative Fuels Data Center', href: afdcStationUrl(station.id) },
        ]}
      >
        {station.lastConfirmed ? `last confirmed ${fmtDate(station.lastConfirmed)}` : null}
      </DetailSource>
    </div>
  );
}
