import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchSkiResorts } from '../services/skiApi';
import type { SkiResort } from '../services/skiApi';
import { SKI_COLORS } from '../utils/skiColors';
import { escapeHTML } from '../utils/sanitize';
import type { MapLibreMap, Marker } from '../types';
import './SkiLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface SkiLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
}

// Lucide Mountain icon SVG
const MOUNTAIN_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
  </svg>
`;

function createSkiResortMarker(resort: SkiResort): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'ski-resort-marker';

  const color = SKI_COLORS[resort.color as keyof typeof SKI_COLORS] || SKI_COLORS.yellow;

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

  el.innerHTML = MOUNTAIN_ICON;

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

function createPopupHTML(resort: SkiResort): string {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Sanitize all dynamic content to prevent XSS
  const safeName = escapeHTML(resort.name);
  const safeLogoUrl = escapeHTML(resort.logoUrl);

  return `
    <div class="ski-popup-content">
      ${resort.logoUrl ? `<img src="${safeLogoUrl}" alt="${safeName}" class="resort-logo" />` : ''}
      <h3>${safeName}</h3>
      <div class="stats-grid">
        <div>❄️ Fresh: ${resort.snowfall24hr !== null ? `${escapeHTML(String(resort.snowfall24hr))}"` : 'N/A'}</div>
        <div>🎿 Trails: ${escapeHTML(String(resort.trailsOpen))}/${escapeHTML(String(resort.trailsTotal))}</div>
        <div>🚡 Lifts: ${escapeHTML(String(resort.liftsOpen))}/${escapeHTML(String(resort.liftsTotal))}</div>
        <div>🌡️ Temp: ${resort.tempCurrent !== null ? `${escapeHTML(String(resort.tempCurrent))}°F` : 'N/A'}</div>
        <div>📊 Base: ${resort.baseDepth !== null ? `${escapeHTML(String(resort.baseDepth))}"` : 'N/A'}</div>
        <div>📈 Total: ${resort.snowfallCumulative !== null ? `${escapeHTML(String(resort.snowfallCumulative))}"` : 'N/A'}</div>
      </div>
      <div class="last-updated">Updated: ${formatTime(resort.lastUpdated)}</div>
    </div>
  `;
}

function SkiLayer({ map, visible }: SkiLayerProps) {
  const [resorts, setResorts] = useState<SkiResort[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);

  // Fetch resorts on mount and every 6 hours
  useEffect(() => {
    if (!map) return;

    const fetchResorts = async (): Promise<void> => {
      if (!map) return;

      setLoading(true);
      try {
        const data = await fetchSkiResorts();
        setResorts(data);
      } catch (error) {
        // Silently fail - ski data is non-critical
        if (import.meta.env.DEV) {
          console.error('Error fetching ski resorts:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResorts();
    const interval = setInterval(fetchResorts, 6 * 60 * 60 * 1000); // 6 hours
    return () => clearInterval(interval);
  }, [map]);

  // Add markers to map when resorts change
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

    // Add new markers for resorts
    resorts.forEach((resort) => {
      const el = createSkiResortMarker(resort);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([resort.longitude, resort.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'ski-popup',
          maxWidth: '320px',
        })
          .setLngLat([resort.longitude, resort.latitude])
          .setHTML(createPopupHTML(resort))
          .addTo(map);

        // Handle logo load errors
        const popupElement = popup.getElement();
        const logoImg = popupElement?.querySelector('.resort-logo') as HTMLImageElement;
        if (logoImg) {
          logoImg.addEventListener('error', () => {
            logoImg.style.display = 'none';
          });
        }
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
  }, [map, visible, resorts]);

  // No UI panel - markers only
  return null;
}

export default memo(SkiLayer);
