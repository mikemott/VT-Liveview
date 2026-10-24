/**
 * DetailPanel - Unified sliding panel for displaying details
 * Replaces MapLibre popups with a consistent glassmorphic design
 */

import { useEffect } from 'react';
import { Share2, X } from 'lucide-react';
import type { DetailPanelContent } from '../types';
import AlertDetail from './detail-views/AlertDetail';
import IncidentDetail from './detail-views/IncidentDetail';
import StationDetail from './detail-views/StationDetail';
import LocationDetail from './detail-views/LocationDetail';
import CameraDetail from './detail-views/CameraDetail';
import SeasonalRoadDetail from './detail-views/SeasonalRoadDetail';
import RoadWeatherDetail from './detail-views/RoadWeatherDetail';
import './DetailPanel.css';

interface DetailPanelProps {
  content: DetailPanelContent;
  onClose: () => void;
  /** Share a link to this view (the URL already includes the selection). */
  onShare?: () => void;
  isDark: boolean;
}

export default function DetailPanel({ content, onClose, onShare, isDark }: DetailPanelProps) {
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
      case 'location':
        return 'Location Details';
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
      case 'seasonalRoad':
        return <SeasonalRoadDetail road={content.data} status={content.status} isDark={isDark} />;
      case 'location':
        return <LocationDetail coordinates={content.coordinates} isDark={isDark} />;
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
          {onShare && content?.type !== 'incident' && (
            <button
              type="button"
              className="detail-panel-close detail-panel-share"
              onClick={onShare}
              aria-label="Share a link to this"
              title="Share a link to this"
            >
              <Share2 size={18} />
            </button>
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
