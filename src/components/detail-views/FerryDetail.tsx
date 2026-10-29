/**
 * FerryDetail - a Lake Champlain ferry crossing (VTL-81)
 */
import { ExternalLink } from 'lucide-react';
import type { Ferry } from '../../data/ferries';
import type { FerryStatus } from '../../utils/ferries';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailRows, DetailSource, DetailStatus } from './DetailParts';
import './DetailViews.css';

interface FerryDetailProps {
  ferry: Ferry;
  status: FerryStatus;
  isDark: boolean;
}

const KIND_LABEL: Record<Ferry['kind'], string> = {
  car: 'Car ferry',
  passenger: 'Passenger ferry',
  bike: 'Bike ferry',
};

const CARRIES: Record<Ferry['kind'], string> = {
  car: 'Cars, bikes and people on foot',
  passenger: 'People on foot',
  bike: 'Bikes and people on foot',
};

export default function FerryDetail({ ferry, status, isDark }: FerryDetailProps) {
  return (
    <div className={`detail-view ferry-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="ferries" label={KIND_LABEL[ferry.kind]} />
      <DetailHeader name={ferry.name} location={ferry.between} />

      <DetailStatus tone={status.tone}>{status.label}</DetailStatus>

      <DetailRows
        rows={[
          ['When', ferry.service],
          ['Crossing', `About ${ferry.crossingMinutes} minutes`],
          ['Carries', CARRIES[ferry.kind]],
          ['Operator', ferry.operator],
          ['Phone', ferry.phone ? <a href={`tel:${ferry.phone}`}>{ferry.phone}</a> : null],
        ]}
      />

      {ferry.notes.length > 0 && (
        <ul className="ferry-notes">
          {ferry.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <p>
        <a
          className="detail-link"
          href={ferry.operatorUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Today’s schedule and service alerts <ExternalLink size={13} aria-hidden="true" />
        </a>
      </p>

      <DetailSource>
        From the operator’s published information (October 2026); weather, ice and low water change
        service day to day, so check the operator before you go. Route: OpenStreetMap.
      </DetailSource>
    </div>
  );
}
