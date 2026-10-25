/**
 * DarkSkyDetail - a stargazing site with parking (VTL-64)
 */
import type { DarkSkySite } from '../../types/stargazing';
import { BORTLE_DESCRIPTIONS } from '../../types/stargazing';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailRows, DetailSource, DetailStatus, DetailTags } from './DetailParts';
import './DetailViews.css';

interface DarkSkyDetailProps {
  site: DarkSkySite;
  isDark: boolean;
}

const BEST_FOR: Record<DarkSkySite['bestFor'][number], string> = {
  'milky-way': 'Milky Way',
  'deep-sky': 'deep-sky objects',
  planets: 'planets',
  aurora: 'aurora',
  'meteor-showers': 'meteor showers',
};

const LAND: Record<DarkSkySite['landType'], string> = {
  'state-forest': 'State forest',
  'national-forest': 'National forest',
  'state-park': 'State park',
  'town-forest': 'Town forest',
  'public-land': 'Public land',
};

export default function DarkSkyDetail({ site, isDark }: DarkSkyDetailProps) {
  const sky = BORTLE_DESCRIPTIONS[site.bortleClass];
  const facilities = [
    site.facilities.parking && 'parking',
    site.facilities.camping && 'camping',
    site.facilities.restrooms && 'restrooms',
  ].filter((f): f is string => typeof f === 'string');

  return (
    <div className={`detail-view dark-sky-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="stargazing" label="Dark sky site" />
      <DetailHeader name={site.name} location={LAND[site.landType]} />
      <DetailStatus
        tone={site.bortleClass <= 3 ? 'good' : site.bortleClass <= 5 ? 'warn' : 'neutral'}
      >
        Bortle {site.bortleClass}: {sky.description}
      </DetailStatus>
      <p className="detail-note">{site.description}</p>
      <DetailRows
        rows={[
          ['Sky quality (SQM)', site.sqmReading ? `${site.sqmReading} mag/arcsec²` : null],
          [
            'Elevation',
            site.elevation ? `${Math.round(site.elevation * 3.281).toLocaleString()} ft` : null,
          ],
          ['Access', site.accessibility[0]!.toUpperCase() + site.accessibility.slice(1)],
          ['Best for', site.bestFor.map((b) => BEST_FOR[b]).join(', ')],
        ]}
      />
      <DetailTags label="Facilities" tags={facilities} />
      {site.viewingNotes && <p className="detail-note">{site.viewingNotes}</p>}
      <DetailSource>Bortle scale: lower is darker (1 is pristine)</DetailSource>
    </div>
  );
}
