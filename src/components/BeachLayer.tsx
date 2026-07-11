import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchBeaches } from '../services/beachApi';
import type { Beach } from '../services/beachApi';
import { BEACH_COLORS } from '../utils/beachColors';
import { escapeHTML } from '../utils/sanitize';
import type { MapLibreMap, Marker } from '../types';
import './BeachLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface BeachLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
}

// Lucide Waves icon SVG
const WAVES_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  </svg>
`;

function createBeachMarker(beach: Beach): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'beach-marker';

  const color = BEACH_COLORS[beach.color as keyof typeof BEACH_COLORS] || BEACH_COLORS.yellow;

  el.style.cssText = `
    width: 32px;
    height: 32px;
    background: ${color};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
  `;

  el.innerHTML = WAVES_ICON;

  // Hover glow effect
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${color}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}

function createPopupHTML(beach: Beach): string {
  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Sanitize all dynamic content
  const safeName = escapeHTML(beach.name);
  const safeTown = escapeHTML(beach.town);
  const safeAdvisory = beach.advisory ? escapeHTML(beach.advisory) : null;

  // Status badge
  const statusEmoji = beach.status === 'open' ? '✅' : beach.status === 'alert' ? '⚠️' : beach.status === 'closed' ? '🚫' : '❓';
  const statusLabel = beach.status === 'open' ? 'Open' : beach.status === 'alert' ? 'Alert' : beach.status === 'closed' ? 'Closed' : 'Unknown';

  return `
    <div class="beach-popup-content">
      <h3>${safeName}</h3>
      <div class="beach-location">${safeTown}</div>

      <div class="beach-status ${beach.status}">
        ${statusEmoji} ${statusLabel}
      </div>

      ${beach.waterQualityGrade ? `
        <div class="water-quality-section">
          <div class="quality-grade grade-${beach.waterQualityGrade.toLowerCase()}">${beach.waterQualityGrade}</div>
          ${beach.eColiLevel !== null ? `
            <div class="detail-row">
              <span>E. coli:</span>
              <span>${escapeHTML(String(beach.eColiLevel))} per 100mL</span>
            </div>
          ` : ''}
          ${beach.lastTested ? `
            <div class="detail-row">
              <span>Tested:</span>
              <span>${formatDate(beach.lastTested)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${safeAdvisory ? `
        <div class="beach-advisory">${safeAdvisory}</div>
      ` : ''}

      ${beach.amenities.length > 0 ? `
        <div class="beach-amenities">
          ${beach.amenities.map(a => {
            const amenityIcons: Record<string, string> = {
              'parking': '🅿️',
              'restrooms': '🚻',
              'concessions': '🍔',
              'lifeguards': '🏊',
              'boat_launch': '🚤',
              'picnic_area': '🧺',
              'swimming': '🏊‍♀️',
            };
            const icon = amenityIcons[a] || '•';
            const label = escapeHTML(a.replace(/_/g, ' '));
            return `<span class="amenity">${icon} ${label}</span>`;
          }).join('')}
        </div>
      ` : ''}

      <div class="last-updated">Updated: ${formatDate(beach.lastUpdated)}</div>
    </div>
  `;
}

function BeachLayer({ map, visible }: BeachLayerProps) {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);
  const currentPopupRef = useRef<maplibregl.Popup | null>(null);

  // Fetch beaches on mount and every 12 hours (matches backend cache)
  useEffect(() => {
    if (!map) return;

    const fetchBeachData = async (): Promise<void> => {
      if (!map) return;

      setLoading(true);
      try {
        const data = await fetchBeaches();
        setBeaches(data);
      } catch (error) {
        // Silently fail - beach data is non-critical
        if (import.meta.env.DEV) {
          console.error('Error fetching beaches:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBeachData();
    const interval = setInterval(fetchBeachData, 12 * 60 * 60 * 1000); // 12 hours
    return () => clearInterval(interval);
  }, [map]);

  // Add markers to map when beaches change
  useEffect(() => {
    if (!map || !visible) {
      // Clear existing markers
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];

      // Close popup when layer is hidden
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
      return;
    }

    // Remove old markers
    markersRef.current.forEach(({ marker, element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler as EventListener);
      }
      marker.remove();
    });
    markersRef.current = [];

    // Add new markers for beaches
    beaches.forEach((beach) => {
      const el = createBeachMarker(beach);

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center' // Pin marker to center (prevents zoom drift)
      })
        .setLngLat([beach.longitude, beach.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        // Close existing popup
        if (currentPopupRef.current) {
          currentPopupRef.current.remove();
        }

        // Create and show popup
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'beach-popup',
          maxWidth: '320px',
        })
          .setLngLat([beach.longitude, beach.latitude])
          .setHTML(createPopupHTML(beach))
          .addTo(map);

        currentPopupRef.current = popup;
      };

      el.addEventListener('click', handleMarkerClick as EventListener);

      markersRef.current.push({
        marker: marker as Marker,
        element: el,
        handler: handleMarkerClick,
      });
    });

    // Cleanup
    return () => {
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];

      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
    };
  }, [map, visible, beaches]);

  // No UI panel - markers only
  return null;
}

export default memo(BeachLayer);
