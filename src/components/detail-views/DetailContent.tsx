/**
 * The body of the detail panel: one view per kind of item.
 *
 * Kept in its own module so the views load as a separate chunk, after the map
 * (VTL-95). DetailPanel imports it lazily and preloads it once the page is idle.
 */
import type { DetailPanelContent } from '../../types';
import AlertDetail from './AlertDetail';
import IncidentDetail from './IncidentDetail';
import StationDetail from './StationDetail';
import LocationDetail from './LocationDetail';
import CameraDetail from './CameraDetail';
import SeasonalRoadDetail from './SeasonalRoadDetail';
import RoadWeatherDetail from './RoadWeatherDetail';
import AirQualityDetail from './AirQualityDetail';
import RiverDetail from './RiverDetail';
import EvChargerDetail from './EvChargerDetail';
import FireDangerDetail from './FireDangerDetail';
import FerryDetail from './FerryDetail';
import SkiDetail from './SkiDetail';
import BeachDetail from './BeachDetail';
import CreemeeDetail from './CreemeeDetail';
import CampgroundDetail from './CampgroundDetail';
import CampingAreaDetail from './CampingAreaDetail';
import DarkSkyDetail from './DarkSkyDetail';

interface DetailContentProps {
  content: DetailPanelContent;
  /** Open another item in the panel (from "What's here?" alerts and nearby) */
  onNavigate?: ((content: DetailPanelContent) => void) | undefined;
  isDark: boolean;
}

export default function DetailContent({ content, onNavigate, isDark }: DetailContentProps) {
  if (!content) return null;

  switch (content.type) {
    case 'alert':
      return <AlertDetail alert={content.data} isDark={isDark} />;
    case 'incident':
      return <IncidentDetail incident={content.data} isDark={isDark} />;
    case 'station':
      return <StationDetail station={content.data} isDark={isDark} />;
    case 'camera':
      // key: a different camera remounts with fresh image state
      return (
        <CameraDetail
          key={content.data.id}
          camera={content.data}
          views={content.views}
          onSelectView={onNavigate && ((camera) => onNavigate({ type: 'camera', data: camera }))}
          isDark={isDark}
        />
      );
    case 'roadWeather':
      return <RoadWeatherDetail station={content.data} isDark={isDark} />;
    case 'airQuality':
      return <AirQualityDetail monitor={content.data} isDark={isDark} />;
    case 'river':
      return <RiverDetail key={content.data.id} gauge={content.data} isDark={isDark} />;
    case 'evCharger':
      return <EvChargerDetail station={content.data} isDark={isDark} />;
    case 'fireDanger':
      return <FireDangerDetail area={content.data} isDark={isDark} />;
    case 'ferry':
      return <FerryDetail ferry={content.data} status={content.status} isDark={isDark} />;
    case 'ski':
      return <SkiDetail resort={content.data} isDark={isDark} />;
    case 'beach':
      return <BeachDetail beach={content.data} isDark={isDark} />;
    case 'creemee':
      return <CreemeeDetail stand={content.data} isDark={isDark} />;
    case 'campground':
      return <CampgroundDetail site={content.data} isDark={isDark} />;
    case 'campingArea':
      return <CampingAreaDetail area={content.data} isDark={isDark} />;
    case 'darkSky':
      return <DarkSkyDetail site={content.data} isDark={isDark} />;
    case 'seasonalRoad':
      return <SeasonalRoadDetail road={content.data} status={content.status} isDark={isDark} />;
    case 'location':
      return (
        <LocationDetail
          coordinates={content.coordinates}
          context={content.context}
          onOpen={onNavigate}
          isDark={isDark}
        />
      );
    default:
      return null;
  }
}
