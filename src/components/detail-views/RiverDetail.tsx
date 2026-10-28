/**
 * RiverDetail - an NWS/USGS river or lake gauge (VTL-81)
 */
import type { RiverGauge, RiverGaugeDetail, StagePoint } from '../../services/riverApi';
import { useRiverGauge } from '../../hooks/useRiverGauge';
import { getObservationAge } from '../../utils/observationAge';
import {
  FLOOD_LEVELS,
  floodSeverity,
  floodStageFor,
  floodToneVars,
  formatFlow,
  formatStage,
  impactAt,
  isRiverReadingStale,
} from '../../utils/rivers';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailRows, DetailSource } from './DetailParts';
import '../../styles/flood.css';
import './DetailViews.css';

interface RiverDetailProps {
  gauge: RiverGauge;
  isDark: boolean;
}

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric' });

const fmtYear = (date: string): string =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function forecastCrest(detail: RiverGaugeDetail | undefined): StagePoint | null {
  const f = detail?.forecast ?? [];
  return f.length > 0 ? f.reduce((a, b) => (b.stageFt > a.stageFt ? b : a)) : null;
}

const W = 300;
const H = 110;
const PAD = { top: 8, right: 4, bottom: 16, left: 4 };

/** Last week's levels (solid) and the NWS forecast (dashed), with flood stage when it's in reach */
export function Hydrograph({ detail }: { detail: RiverGaugeDetail }) {
  const { observed, forecast } = detail;
  const all = [...observed, ...forecast];
  if (all.length < 2) return null;
  const t0 = Date.parse(all[0]!.t);
  const t1 = Date.parse(all[all.length - 1]!.t);
  const lo = Math.min(...all.map((p) => p.stageFt));
  const hi = Math.max(...all.map((p) => p.stageFt));
  // Draw flood stage only when the river comes within reach of it; otherwise
  // the line would squash the week's ups and downs flat
  const floodFt = floodStageFor(detail.floodStages);
  const showFlood = floodFt !== null && hi >= lo + (floodFt - lo) * 0.6;
  const top = showFlood ? Math.max(hi, floodFt) : hi;
  const span = Math.max(top - lo, 0.5);
  const yMin = lo - span * 0.1;
  const yMax = top + span * 0.1;
  const x = (t: string): number =>
    PAD.left + ((Date.parse(t) - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
  const y = (ft: number): number =>
    PAD.top + (1 - (ft - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const path = (pts: StagePoint[]): string =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.stageFt).toFixed(1)}`).join('');
  // Join the forecast to the last observation so the lines meet
  const fcst =
    observed.length > 0 && forecast.length > 0 ? [observed.at(-1)!, ...forecast] : forecast;
  const nowX = observed.length > 0 ? x(observed.at(-1)!.t) : null;

  const summary = [
    `River level over the last ${observed.length > 0 ? 'week' : 'period'}: ${formatStage(lo)} to ${formatStage(hi)}`,
    forecast.length > 0 ? 'dashed line is the NWS forecast' : '',
    showFlood ? `flood stage ${formatStage(floodFt)}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  return (
    <figure className="river-hydrograph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {showFlood && (
          <g className="river-hydrograph-flood">
            <line x1={PAD.left} x2={W - PAD.right} y1={y(floodFt)} y2={y(floodFt)} />
            <text x={W - PAD.right} y={y(floodFt) - 3} textAnchor="end">
              Flood {formatStage(floodFt)}
            </text>
          </g>
        )}
        {nowX !== null && forecast.length > 0 && (
          <line
            className="river-hydrograph-now"
            x1={nowX}
            x2={nowX}
            y1={PAD.top}
            y2={H - PAD.bottom}
          />
        )}
        {observed.length > 1 && <path className="river-hydrograph-obs" d={path(observed)} />}
        {fcst.length > 1 && <path className="river-hydrograph-fcst" d={path(fcst)} />}
        {/* The week's high and low, at the left edge (aria-hidden: the summary says it) */}
        <g className="river-hydrograph-axis" aria-hidden="true">
          <text x={PAD.left} y={y(hi) - 4}>
            {formatStage(hi)}
          </text>
          <text x={PAD.left} y={y(lo) + 12}>
            {formatStage(lo)}
          </text>
        </g>
        <text className="river-hydrograph-axis" x={PAD.left} y={H - 3}>
          {fmtWhen(all[0]!.t)}
        </text>
        <text className="river-hydrograph-axis" x={W - PAD.right} y={H - 3} textAnchor="end">
          {fmtWhen(all[all.length - 1]!.t)}
        </text>
      </svg>
    </figure>
  );
}

export default function RiverDetail({ gauge, isDark }: RiverDetailProps) {
  const { data: detail, isError } = useRiverGauge(gauge.id);
  const level = FLOOD_LEVELS[gauge.category];
  const age = getObservationAge(gauge.observedAt);
  const stale = isRiverReadingStale(gauge.observedAt);
  const isLake = /lake/i.test(gauge.name);
  const crest = forecastCrest(detail);
  const floodFt = detail ? floodStageFor(detail.floodStages) : null;
  const peak = Math.max(gauge.stageFt ?? -Infinity, crest?.stageFt ?? -Infinity);
  const impact = detail ? impactAt(detail.impacts, Number.isFinite(peak) ? peak : null) : null;
  const forecastWorse = floodSeverity(gauge.forecastCategory) > floodSeverity(gauge.category);
  const where = detail?.county ? `${detail.county} County, ${gauge.state}` : gauge.state;
  const stages = detail?.floodStages;
  const stageList = stages
    ? (
        [
          ['Action', stages.action],
          ['Minor', stages.minor],
          ['Moderate', stages.moderate],
          ['Major', stages.major],
        ] as const
      )
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ')
    : '';

  return (
    <div className={`detail-view river-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="riverGauges" label={isLake ? 'Lake gauge' : 'River gauge'} />
      <DetailHeader name={gauge.name} location={where} />

      <div className="aq-headline flood-tone" role="status" style={floodToneVars(gauge.category)}>
        <span className="aq-headline-value">
          {gauge.stageFt === null ? '—' : gauge.stageFt.toFixed(gauge.stageFt >= 100 ? 1 : 2)}
        </span>
        <span className="aq-headline-text">
          <span className="aq-headline-label">{isLake ? 'Lake level, ft' : 'Stage, ft'}</span>
          <span className="aq-headline-name">{level.name}</span>
        </span>
      </div>

      {forecastWorse && gauge.forecastCategory && (
        <div
          className="river-forecast-warning flood-tone"
          role="status"
          style={floodToneVars(gauge.forecastCategory)}
        >
          Forecast: {FLOOD_LEVELS[gauge.forecastCategory].name.toLowerCase()}
          {crest ? `, cresting near ${formatStage(crest.stageFt)} ${fmtWhen(crest.t)}` : ''}
        </div>
      )}

      <DetailRows
        rows={[
          ['Flow', gauge.flowCfs === null ? null : formatFlow(gauge.flowCfs)],
          [
            'Flood stage',
            floodFt === null
              ? null
              : gauge.stageFt !== null && gauge.stageFt < floodFt
                ? `${formatStage(floodFt)} (${(floodFt - gauge.stageFt).toFixed(1)} ft below)`
                : formatStage(floodFt),
          ],
          [
            'Forecast crest',
            crest && !forecastWorse ? `${formatStage(crest.stageFt)} ${fmtWhen(crest.t)}` : null,
          ],
        ]}
      />

      {age.ago && (
        <div className={`camera-caption${stale ? ' stale' : ''}`}>
          {stale ? '⚠️ Old reading: ' : 'Reading '}
          {age.ago} ({age.asOf})
        </div>
      )}

      {detail && <Hydrograph detail={detail} />}
      {isError && <p className="detail-note">Couldn’t load this gauge’s history and forecast.</p>}

      {impact && (
        <div className="detail-section">
          <div className="section-label">
            {impact.reached
              ? `At ${formatStage(impact.stageFt)}`
              : `First impacts, at ${formatStage(impact.stageFt)}`}
          </div>
          <p className="detail-note">{impact.statement}</p>
        </div>
      )}

      {detail && detail.historicCrests.length > 0 && (
        <div className="detail-section">
          <div className="section-label">Highest crests</div>
          <DetailRows
            rows={detail.historicCrests.map((c) => [fmtYear(c.date), formatStage(c.stageFt)])}
          />
        </div>
      )}

      {stageList && <div className="station-updated">NWS flood stages (ft): {stageList}</div>}
      <DetailSource>
        Source: NWS National Water Prediction Service
        {detail?.usgsId ? ` and USGS gauge ${detail.usgsId}` : ''}.{' '}
        <a
          href={`https://water.noaa.gov/gauges/${encodeURIComponent(gauge.id)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Full forecast
        </a>
      </DetailSource>
    </div>
  );
}
