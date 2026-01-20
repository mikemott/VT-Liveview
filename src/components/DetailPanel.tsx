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
import HistoricalDetail from './detail-views/HistoricalDetail';
import './DetailPanel.css';

interface DetailPanelProps {
  content: DetailPanelContent;
  onClose: () => void;
  isDark: boolean;
}

export default function DetailPanel({ content, onClose, isDark }: DetailPanelProps) {
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
      case 'historical':
        return 'Historical Data';
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
      case 'historical':
        return <HistoricalDetail coordinates={content.coordinates} isDark={isDark} />;
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
          <button
            className="detail-panel-close"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <X size={20} />
          </button>
        </div>

        <div className="detail-panel-content">
          {renderContent()}
        </div>
      </div>
    </>
  );
}
