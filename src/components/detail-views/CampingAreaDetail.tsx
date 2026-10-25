/**
 * CampingAreaDetail - a state park/forest with backcountry sites (VTL-64)
 */
import { ExternalLink } from 'lucide-react';
import type { CampingArea } from '../../services/campingApi';
import LayerBadge from './LayerBadge';
import { PARK_TYPE_LABELS, stateParkUrl } from '../../utils/campingAreas';
import { DetailHeader, DetailRows, DetailSource } from './DetailParts';
import './DetailViews.css';

interface CampingAreaDetailProps {
  area: CampingArea;
  isDark: boolean;
}

export default function CampingAreaDetail({ area, isDark }: CampingAreaDetailProps) {
  const url = stateParkUrl(area);
  const types = [...new Set(area.sites.map((s) => s.siteType).filter(Boolean))];
  return (
    <div className={`detail-view camping-area-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="campingSites" label="Backcountry camping" />
      <DetailHeader name={area.name} location={PARK_TYPE_LABELS[area.type] ?? null} />
      <DetailRows
        rows={[
          ['Backcountry sites', area.siteCount],
          ['Site types', types.length > 0 ? types.join(', ') : null],
        ]}
      />
      {url && (
        <p>
          <a className="detail-link" href={url} target="_blank" rel="noopener noreferrer">
            Park website <ExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
      )}
      <DetailSource>Source: Vermont ANR · backcountry and primitive sites</DetailSource>
    </div>
  );
}
