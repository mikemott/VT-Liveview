/**
 * BeachDetail - water quality and amenities for a Vermont beach (VTL-64)
 */
import type { Beach } from '../../services/beachApi';
import { getBeachDisplay, parseBeachTestDate } from '../../utils/beachStatus';
import { SOURCES } from '../../utils/sourceLinks';
import Temp from '../Temp';
import LayerBadge from './LayerBadge';
import { formatDateTime } from '../../utils/formatDateTime';
import { DetailHeader, DetailRows, DetailSource, DetailStatus, DetailTags } from './DetailParts';
import './DetailViews.css';

interface BeachDetailProps {
  beach: Beach;
  isDark: boolean;
}

const TONE = { open: 'good', alert: 'warn', closed: 'bad' } as const;

export default function BeachDetail({ beach, isDark }: BeachDetailProps) {
  const display = getBeachDisplay(beach);
  const tested = parseBeachTestDate(beach.lastTested);
  const showQuality = display.state !== 'stale' && display.state !== 'unmonitored';
  const tone = TONE[display.state as keyof typeof TONE] ?? 'neutral';
  const updated = formatDateTime(beach.lastUpdated);
  // Only Burlington's beaches are tested (City of Burlington); the rest are our own list
  const monitored = beach.lastTested !== null || beach.status !== 'unknown';

  return (
    <div className={`detail-view beach-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="beachSites" label="Beach" />
      <DetailHeader name={beach.name} location={beach.town} />

      <DetailStatus tone={tone}>
        {display.label}
        {display.detail && <span className="detail-status-note">{display.detail}</span>}
      </DetailStatus>

      {beach.advisory && <p className="detail-note">{beach.advisory}</p>}

      {showQuality && (
        <DetailRows
          rows={[
            ['Water quality', beach.waterQualityGrade],
            ['E. coli', beach.eColiLevel === null ? null : `${beach.eColiLevel} per 100 mL`],
            [
              'Water temperature',
              beach.waterTemp === null ? null : <Temp value={beach.waterTemp} />,
            ],
            ['Tested', tested ? formatDateTime(tested.toISOString()) : null],
          ]}
        />
      )}

      <DetailTags label="Amenities" tags={beach.amenities.map((a) => a.replace(/_/g, ' '))} />

      {monitored ? (
        <DetailSource sources={[SOURCES.burlington]}>
          {updated ? `updated ${updated}` : null}
        </DetailSource>
      ) : (
        <DetailSource
          curated
          sources={beach.parkType === 'state_park' ? [SOURCES.vtStateParks] : []}
        />
      )}
    </div>
  );
}
