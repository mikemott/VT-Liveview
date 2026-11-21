/**
 * DetailPanel - Unified sliding panel for displaying details
 * Replaces MapLibre popups with a consistent glassmorphic design
 */

import { lazy, Suspense, useEffect } from 'react';
import { X } from 'lucide-react';
import type { DetailPanelContent } from '../types';
import ShareMenu from './ShareMenu';
import './DetailPanel.css';

// The views load as their own chunk so they stay out of the first download (VTL-95)
const loadDetailContent = () => import('./detail-views/DetailContent');
const DetailContent = lazy(loadDetailContent);

/** How long after mount to fetch the views in the background, so a first tap rarely waits */
const PRELOAD_DELAY_MS = 3000;

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

  // Fetch the views once the page has settled
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDetailContent().catch(() => {
        // A failed preload is retried by the lazy import when the panel opens
      });
    }, PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

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

        <div className="detail-panel-content">
          {content && (
            <Suspense fallback={<div className="detail-panel-loading" aria-busy="true" />}>
              <DetailContent content={content} onNavigate={onNavigate} isDark={isDark} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
