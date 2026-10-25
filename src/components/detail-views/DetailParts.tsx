/**
 * Building blocks shared by the detail views (VTL-64), so every panel lays
 * out the same way: badge → name → location → status → rows → tags → source.
 */
import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';

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

/** Footer line: where the data comes from / when it was updated */
export function DetailSource({ children }: { children: ReactNode }) {
  return <div className="station-updated">{children}</div>;
}
