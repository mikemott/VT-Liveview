/**
 * CampgroundDetail - a campground from ANR recreation sites (VTL-64)
 */
import type { RecreationSite } from '../../services/recreationApi';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailRows, DetailSource, DetailTags } from './DetailParts';
import './DetailViews.css';

interface CampgroundDetailProps {
  site: RecreationSite;
  isDark: boolean;
}

const count = (n: number): number | null => (n > 0 ? n : null);

export default function CampgroundDetail({ site, isDark }: CampgroundDetailProps) {
  const camping = site.amenities.camping;
  const swimming = site.amenities.swimming;
  const location = [site.address, site.town].filter(Boolean).join(', ') || null;

  const features = [
    camping?.groupCamping && 'group camping',
    camping?.primitiveCamping && 'primitive sites',
    camping?.winterCamping && 'winter camping',
    swimming?.hasBeach && 'beach',
    swimming?.lakeSwimming && 'lake swimming',
    swimming?.poolSwimming && 'pool',
    swimming?.riverSwimming && 'river swimming',
    site.amenities.boatRental && 'boat rental',
    site.amenities.picnicArea && 'picnic area',
    site.amenities.playground && 'playground',
  ].filter((f): f is string => typeof f === 'string');

  return (
    <div className={`detail-view campground-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="campingSites" label="Campground" />
      <DetailHeader name={site.name} location={location} />
      <DetailRows
        rows={[
          ['Operator', site.organization],
          ['Access', site.isPublic ? 'Public' : 'Private'],
          ['Phone', site.phone ? <a href={`tel:${site.phone}`}>{site.phone}</a> : null],
          ['Tent sites', camping ? count(camping.tentSites) : null],
          ['RV sites', camping ? count(camping.rvSites) : null],
          ['Shelters', camping ? count(camping.shelters) : null],
          ['Electric hookups', camping ? count(camping.hookups.electric) : null],
          ['Water hookups', camping ? count(camping.hookups.water) : null],
          ['Full hookups', camping ? count(camping.hookups.both) : null],
          ['Swimming at', swimming?.waterBodyName ?? null],
          ['Acreage', site.acreage ? `${site.acreage.toLocaleString()} acres` : null],
          ['Parking', site.parkingSpaces ? `${site.parkingSpaces} spaces` : null],
        ]}
      />
      <DetailTags label="Features" tags={features} />
      <DetailSource>Source: Vermont ANR recreation sites</DetailSource>
    </div>
  );
}
