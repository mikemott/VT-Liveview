import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchCreemeeStands } from '../services/creemeeApi';
import type { CreemeeStand } from '../services/creemeeApi';
import { escapeHTML } from '../utils/sanitize';
import type { MapLibreMap, Marker } from '../types';
import './CreemeeLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface CreemeeLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
}

// Lucide IceCream icon (matches filter chip)
const CREEMEE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/>
    <path d="M17 7A5 5 0 0 0 7 7"/>
    <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>
  </svg>
`;

function createCreemeeMarker(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'creemee-stand-marker';
  el.innerHTML = CREEMEE_ICON;
  return el;
}

function createPopupHTML(stand: CreemeeStand): string {
  // Sanitize all dynamic content to prevent XSS
  const safeName = escapeHTML(stand.name);
  const safeTown = escapeHTML(stand.town);
  const safeDescription = stand.description ? escapeHTML(stand.description) : '';

  return `
    <div class="creemee-popup-content">
      <h3>${safeName}</h3>
      ${stand.featured ? '<div class="featured-badge">⭐ Featured</div>' : ''}
      <div class="stand-location">📍 ${safeTown}, VT</div>
      ${stand.description ? `<div class="stand-description">${safeDescription}</div>` : ''}
      ${stand.specialties && stand.specialties.length > 0 ? `
        <div class="stand-specialties">
          <strong>Specialties:</strong>
          <ul>
            ${stand.specialties.map(s => `<li>${escapeHTML(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="stand-meta">
        <span class="licensed-badge">✓ Licensed by VT Dept of Agriculture</span>
      </div>
    </div>
  `;
}

function CreemeeLayer({ map, visible }: CreemeeLayerProps) {
  const [stands, setStands] = useState<CreemeeStand[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);
  const currentPopupRef = useRef<maplibregl.Popup | null>(null);

  // Fetch stands on mount and every 24 hours
  useEffect(() => {
    if (!map) return;

    const fetchStands = async (): Promise<void> => {
      if (!map) return;

      setLoading(true);
      try {
        const data = await fetchCreemeeStands();
        setStands(data);
      } catch (error) {
        // Silently fail - creemee data is non-critical
        if (import.meta.env.DEV) {
          console.error('Error fetching creemee stands:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStands();
    // Refresh once per day (data is relatively static)
    const interval = setInterval(fetchStands, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [map]);

  // Add markers to map when stands change
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

    // Add new markers for stands
    stands.forEach((stand) => {
      const el = createCreemeeMarker();

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stand.longitude, stand.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        // Close existing popup
        if (currentPopupRef.current) {
          currentPopupRef.current.remove();
        }

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'creemee-popup',
          maxWidth: '320px',
        })
          .setLngLat([stand.longitude, stand.latitude])
          .setHTML(createPopupHTML(stand))
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
  }, [map, visible, stands]);

  // No UI panel - markers only
  return null;
}

export default memo(CreemeeLayer);
