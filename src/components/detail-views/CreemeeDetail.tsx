/**
 * CreemeeDetail - a licensed Vermont creemee stand (VTL-64)
 */
import type { CreemeeStand } from '../../services/creemeeApi';
import LayerBadge from './LayerBadge';
import { DetailHeader, DetailSource, DetailTags } from './DetailParts';
import './DetailViews.css';

interface CreemeeDetailProps {
  stand: CreemeeStand;
  isDark: boolean;
}

export default function CreemeeDetail({ stand, isDark }: CreemeeDetailProps) {
  return (
    <div className={`detail-view creemee-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge
        layer="creemeeStands"
        label={stand.featured ? 'Creemee stand · Featured' : 'Creemee stand'}
      />
      <DetailHeader name={stand.name} location={`${stand.town}, VT`} />
      {stand.description && <p className="detail-note">{stand.description}</p>}
      <DetailTags label="Specialties" tags={stand.specialties ?? []} />
      <DetailSource>Licensed by the Vermont Agency of Agriculture</DetailSource>
    </div>
  );
}
