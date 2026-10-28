/**
 * FireDangerDetail - one of Vermont FPR's Fire Danger Rating Areas (VTL-81)
 */
import { ExternalLink } from 'lucide-react';
import type { FireDangerAreaView } from '../../services/fireDangerApi';
import { getObservationAge } from '../../utils/observationAge';
import { fireLevel, fireToneVars, isFireDangerStale } from '../../utils/fireDanger';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailSource } from './DetailParts';
import '../../styles/tone.css';
import './DetailViews.css';

interface FireDangerDetailProps {
  area: FireDangerAreaView;
  isDark: boolean;
}

export default function FireDangerDetail({ area, isDark }: FireDangerDetailProps) {
  const stale = isFireDangerStale(area.updatedAt);
  const rating = stale ? null : area.rating;
  const level = fireLevel(rating);
  const age = getObservationAge(area.updatedAt);

  return (
    <div className={`detail-view fire-danger-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="fireDanger" label={`Fire danger · Area ${area.id}`} />
      <DetailHeader name={area.name} location={area.description} />

      <div className="aq-headline status-tone" role="status" style={fireToneVars(rating)}>
        <span className="aq-headline-text">
          <span className="aq-headline-label">Fire danger today</span>
          <span className="fire-danger-level">{stale ? 'Not current' : level.name}</span>
        </span>
      </div>
      {stale ? (
        <p className="detail-note">
          Vermont posts fire danger each morning from March 20 to November 30.
          {age.asOf ? ` The last rating was posted ${age.ago}.` : ''}
        </p>
      ) : (
        <p className="detail-note">{level.meaning}</p>
      )}

      {!stale && area.notes && (
        <div className="detail-section">
          <div className="section-label">Today statewide</div>
          <p className="detail-note">{area.notes}</p>
        </div>
      )}

      <p className="detail-note">
        Burning brush or untreated wood outdoors in Vermont needs a permit from your town forest
        fire warden, and wardens may stop issuing them when fire danger is high.
      </p>

      <p>
        <a
          className="detail-link"
          href="https://fpr.vermont.gov/forest/wildland-fire/monitoring-fire-danger"
          target="_blank"
          rel="noopener noreferrer"
        >
          Today’s fire danger map <ExternalLink size={13} aria-hidden="true" />
        </a>
      </p>

      <DetailSource>
        Source: Vermont Department of Forests, Parks &amp; Recreation (NFDRS rating)
        {age.ago && !stale ? `, updated ${age.ago}` : ''}.
      </DetailSource>
    </div>
  );
}
