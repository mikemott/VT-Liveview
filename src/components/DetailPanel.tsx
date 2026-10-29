/**
 * DetailPanel - Unified sliding panel for displaying details
 * Replaces MapLibre popups with a consistent glassmorphic design
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { DetailPanelContent } from '../types';
import AlertDetail from './detail-views/AlertDetail';
import IncidentDetail from './detail-views/IncidentDetail';
import StationDetail from './detail-views/StationDetail';
import LocationDetail from './detail-views/LocationDetail';
import CameraDetail from './detail-views/CameraDetail';
import SeasonalRoadDetail from './detail-views/SeasonalRoadDetail';
import RoadWeatherDetail from './detail-views/RoadWeatherDetail';
import AirQualityDetail from './detail-views/AirQualityDetail';
import RiverDetail from './detail-views/RiverDetail';
import EvChargerDetail from './detail-views/EvChargerDetail';
import FireDangerDetail from './detail-views/FireDangerDetail';
import FerryDetail from './detail-views/FerryDetail';
import SkiDetail from './detail-views/SkiDetail';
import BeachDetail from './detail-views/BeachDetail';
import CreemeeDetail from './detail-views/CreemeeDetail';
import CampgroundDetail from './detail-views/CampgroundDetail';
import CampingAreaDetail from './detail-views/CampingAreaDetail';
import DarkSkyDetail from './detail-views/DarkSkyDetail';
import ShareMenu from './ShareMenu';
import './DetailPanel.css';

interface DetailPanelProps {
  content: DetailPanelContent;
  onClose: () => void;
  /** The link and share text for what the panel shows (VTL-70); no share button without it */
  getShare?: () => { url: string; text: string };
  /** Open another item in the panel (from "What's here?" alerts and nearby) */
  onNavigate?: (content: DetailPanelContent) => void;
  isDark: boolean;
}

export default function DetailPanel({
  content,
  onClose,
  getShare,
  onNavigate,
  isDark,
}: DetailPanelProps) {
  const isOpen = content !== null;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getTitle = (): string => {
    if (!content) return '';

    switch (content.type) {
      case 'alert':
        return 'Weather Alert';
      case 'incident':
        return 'Traffic Incident';
      case 'station':
        return 'Weather Station';
      case 'camera':
        return 'Traffic Camera';
      case 'seasonalRoad':
        return 'Seasonal Road';
      case 'roadWeather':
        return 'Road Weather';
      case 'airQuality':
        return 'Air Quality';
      case 'river':
        return 'River Level';
      case 'evCharger':
        return 'EV Charger';
      case 'fireDanger':
        return 'Fire Danger';
      case 'ferry':
        return 'Ferry';
      case 'ski':
        return 'Ski Area';
      case 'beach':
        return 'Beach';
      case 'creemee':
        return 'Creemee Stand';
      case 'campground':
        return 'Campground';
      case 'campingArea':
        return 'Backcountry Camping';
      case 'darkSky':
        return 'Stargazing';
      case 'location':
        return "What's Here";
      default:
        return 'Details';
    }
  };

  const renderContent = () => {
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
        return <CameraDetail key={content.data.id} camera={content.data} isDark={isDark} />;
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
  };

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className={`detail-panel-backdrop ${isOpen ? 'open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Detail panel */}
      <div className={`detail-panel ${isOpen ? 'open' : ''} ${isDark ? 'dark' : ''}`}>
        <div className="detail-panel-header">
          <h2>{getTitle()}</h2>
          {/* Incidents aren't in the shareable URL yet, so no share button for them */}
          {getShare && content?.type !== 'incident' && (
            <ShareMenu
              getShare={getShare}
              isDark={isDark}
              variant="panel"
              label="Share a link to this"
            />
          )}
          <button className="detail-panel-close" onClick={onClose} aria-label="Close detail panel">
            <X size={20} />
          </button>
        </div>

        <div className="detail-panel-content">{renderContent()}</div>
      </div>
    </>
  );
}
