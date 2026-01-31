import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchCreemeeStands } from '../services/creemeeApi';
import type { CreemeeStand } from '../services/creemeeApi';
import { INTERVALS } from '../utils/constants';
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

// Ice cream cone icon (soft serve style)
const CREEMEE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="white" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.5V11c0 1.1.9 2 2 2s2-.9 2-2V9.5c1.2-.7 2-2 2-3.5a4 4 0 0 0-4-4Z"/>
    <path d="M8 11v.5c0 1.4.6 2.6 1.5 3.5L12 22l2.5-6.5c.9-.9 1.5-2.1 1.5-3.5V11"/>
  </svg>
`;

function createCreemeeMarker(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'creemee-stand-marker';

  // Vintage cream/vanilla color to match map theme
  const color = '#F5DEB3'; // Wheat/cream color

  el.style.cssText = `
    width: 32px;
    height: 32px;
    background: ${color};
    border: 2px solid #8B4513;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
    color: #8B4513;
  `;

  el.innerHTML = CREEMEE_ICON;

  // Hover effect
  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.1)';
    el.style.boxShadow = `0 0 12px ${color}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
  });

  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
  });

  return el;
}

function createPopupHTML(stand: CreemeeStand): string {
  return `
    <div class="creemee-popup-content">
      <h3>${stand.name}</h3>
      ${stand.featured ? '<div class="featured-badge">⭐ Featured</div>' : ''}
      <div class="stand-location">📍 ${stand.town}, VT</div>
      ${stand.description ? `<div class="stand-description">${stand.description}</div>` : ''}
      ${stand.specialties && stand.specialties.length > 0 ? `
        <div class="stand-specialties">
          <strong>Specialties:</strong>
          <ul>
            ${stand.specialties.map(s => `<li>${s}</li>`).join('')}
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

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'creemee-popup',
          maxWidth: '320px',
        })
          .setLngLat([stand.longitude, stand.latitude])
          .setHTML(createPopupHTML(stand))
          .addTo(map);
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
    };
  }, [map, visible, stands]);

  // No UI panel - markers only
  return null;
}

export default memo(CreemeeLayer);
