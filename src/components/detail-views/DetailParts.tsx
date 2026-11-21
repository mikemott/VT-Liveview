/**
 * Building blocks shared by the detail views (VTL-64), so every panel lays
 * out the same way: badge → name → location → status → rows → tags → source.
 */
import type { ReactNode } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import type { SourceRef } from '../../utils/sourceLinks';

/** Name and optional location line under the layer badge */
export function DetailHeader({ name, location }: { name: string; location?: string | null }) {
  return (
    <>
      <div className="station-name">{name}</div>
      {location && (
        <div className="station-location">
          <MapPin size={14} aria-hidden="true" />
          <span>{location}</span>
        </div>
      )}
    </>
  );
}

/** Label/value rows; rows whose value is null, undefined or '' are skipped */
export function DetailRows({ rows }: { rows: [label: string, value: ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (shown.length === 0) return null;
  return (
    <dl className="detail-rows">
      {shown.map(([label, value]) => (
        <div key={label} className="detail-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small tags, e.g. amenities */
export function DetailTags({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="detail-section">
      <div className="section-label">{label}</div>
      <ul className="detail-tags">
        {tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** Status banner; `tone` picks the color */
export function DetailStatus({
  tone,
  children,
}: {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  children: ReactNode;
}) {
  return (
    <div className={`detail-status detail-status--${tone}`} role="status">
      {children}
    </div>
  );
}

/** "A", "A and B", "A, B and C" */
function joinNodes(nodes: ReactNode[]): ReactNode[] {
  return nodes.flatMap((node, i) => {
    if (i === 0) return [node];
    return [i === nodes.length - 1 ? ' and ' : ', ', node];
  });
}

/**
 * Footer line: where the data comes from (VTL-96), then any note such as
 * "updated 5 min ago". Every detail window ends with one. Each source links to
 * its public page in a new tab; `curated` marks our own hand-made lists, with
 * `sources` then crediting what they draw on.
 */
export function DetailSource({
  sources = [],
  curated = false,
  children,
}: {
  sources?: SourceRef[];
  curated?: boolean;
  children?: ReactNode;
}) {
  const names = sources.map((s) =>
    s.href ? (
      <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer">
        {s.name}
        <ExternalLink size={11} aria-hidden="true" />
      </a>
    ) : (
      <span key={s.name}>{s.name}</span>
    ),
  );
  const lead = curated
    ? names.length > 0
      ? ['Curated by VT LiveView from ', ...joinNodes(names)]
      : ['Curated by VT LiveView']
    : names.length > 0
      ? ['Source: ', ...joinNodes(names)]
      : [];
  return (
    <div className="station-updated detail-source">
      {lead}
      {lead.length > 0 && children ? ' · ' : null}
      {children}
    </div>
  );
}
