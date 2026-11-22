/**
 * SkiDetail - a ski area's conditions from skivermont.com (VTL-64), with its
 * base-area camera (VTL-87)
 */
import type { SkiResort } from '../../services/skiApi';
import Temp from '../Temp';
import LayerBadge from './LayerBadge';
import { formatDateTime } from '../../utils/formatDateTime';
import { DetailHeader, DetailRows, DetailSource, DetailStatus } from './DetailParts';
import { isSkiReporting } from '../../utils/skiStatus';
import SkiWebcam from './SkiWebcam';
import { useSkiWebcams } from '../../hooks/useSkiWebcams';
import { safeHttpsUrl, SOURCES } from '../../utils/sourceLinks';
import './DetailViews.css';

interface SkiDetailProps {
  resort: SkiResort;
  isDark: boolean;
}

const inches = (v: number | null): string | null => (v === null ? null : `${v}"`);

export default function SkiDetail({ resort, isDark }: SkiDetailProps) {
  const reporting = isSkiReporting(resort);
  const tone = resort.color === 'green' ? 'good' : resort.color === 'yellow' ? 'warn' : 'bad';
  const updated = formatDateTime(resort.lastUpdated);
  // Shared query with SkiWebcam: credit the resort's camera page when there is one
  const { data: webcams } = useSkiWebcams();
  const camPage = safeHttpsUrl(webcams?.resorts[resort.id]?.page);

  return (
    <div className={`detail-view ski-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="skiResorts" label="Ski area" />
      {resort.logoUrl && (
        <img className="ski-detail-logo" src={resort.logoUrl} alt="" loading="lazy" />
      )}
      <DetailHeader name={resort.name} />
      <SkiWebcam resortId={resort.id} resortName={resort.name} />

      {reporting ? (
        <>
          <DetailStatus tone={tone}>
            {tone === 'good'
              ? 'Good conditions'
              : tone === 'warn'
                ? 'Decent conditions'
                : 'Limited conditions'}
          </DetailStatus>
          <DetailRows
            rows={[
              ['Fresh snow (24 h)', inches(resort.snowfall24hr)],
              ['Base depth', inches(resort.baseDepth)],
              ['Season snowfall', inches(resort.snowfallCumulative)],
              [
                'Trails open',
                resort.trailsTotal > 1 || resort.trailsOpen > 0
                  ? `${resort.trailsOpen} / ${resort.trailsTotal}`
                  : null,
              ],
              [
                'Lifts open',
                resort.liftsTotal > 1 || resort.liftsOpen > 0
                  ? `${resort.liftsOpen} / ${resort.liftsTotal}`
                  : null,
              ],
              [
                'Temperature',
                resort.tempCurrent === null ? null : <Temp value={resort.tempCurrent} />,
              ],
            ]}
          />
        </>
      ) : (
        <DetailStatus tone="neutral">
          Not reporting conditions yet
          <span className="detail-status-note">Check the resort's website for opening dates.</span>
        </DetailStatus>
      )}

      <DetailSource
        sources={[
          SOURCES.skiVermont,
          ...(camPage ? [{ name: `${resort.name} webcams`, href: camPage }] : []),
        ]}
      >
        {updated ? `updated ${updated}` : null}
      </DetailSource>
    </div>
  );
}
