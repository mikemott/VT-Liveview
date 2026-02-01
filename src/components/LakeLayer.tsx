import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchLakeTemperatures } from '../services/lakeApi';
import type { LakeTemperature } from '../services/lakeApi';
import { LAKE_COLORS } from '../utils/lakeColors';
import type { MapLibreMap, Marker } from '../types';
import './LakeLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface LakeLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
}

// Lucide Droplet icon SVG
const DROPLET_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  </svg>
`;

function createLakeMarker(lake: LakeTemperature): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'lake-marker';

  const color = LAKE_COLORS[lake.comfortLevel] || LAKE_COLORS.cold;

  el.style.cssText = `
    width: 40px;
    height: 40px;
    background: ${color};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
    position: relative;
  `;

  // Add droplet icon
  const iconDiv = document.createElement('div');
  iconDiv.innerHTML = DROPLET_ICON;
  iconDiv.style.cssText = `
    position: absolute;
    top: 4px;
  `;
  el.appendChild(iconDiv);

  // Add temperature badge if available
  if (lake.temperatureFahrenheit !== null) {
    const tempBadge = document.createElement('div');
    tempBadge.textContent = `${lake.temperatureFahrenheit}°`;
    tempBadge.style.cssText = `
      position: absolute;
      bottom: 2px;
      font-size: 10px;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    `;
    el.appendChild(tempBadge);
  }

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

function createPopupHTML(lake: LakeTemperature): string {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getComfortLabel = (level: string): string => {
    switch (level) {
      case 'cold':
        return 'Too cold for most swimmers';
      case 'comfortable':
        return 'Comfortable for swimming';
      case 'warm':
        return 'Warm water';
      default:
        return '';
    }
  };

  return `
    <div class="lake-popup-content">
      <h3>${lake.name}</h3>
      ${lake.description ? `<p class="lake-description">${lake.description}</p>` : ''}
      <div class="lake-stats">
        ${lake.temperatureFahrenheit !== null
          ? `
            <div class="stat-row">
              <span class="stat-label">Temperature:</span>
              <span class="stat-value">${lake.temperatureFahrenheit}°F</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Comfort:</span>
              <span class="stat-value">${getComfortLabel(lake.comfortLevel)}</span>
            </div>
          `
          : `
            <div class="stat-row no-data">
              <span class="stat-label">Temperature:</span>
              <span class="stat-value">Data not available</span>
            </div>
          `
        }
        ${lake.usgsGaugeId
          ? `
            <div class="stat-row">
              <span class="stat-label">USGS Station:</span>
              <span class="stat-value">${lake.usgsGaugeId}</span>
            </div>
          `
          : ''
        }
      </div>
      <div class="last-updated">
        ${lake.temperatureFahrenheit !== null
          ? `Updated: ${formatTime(lake.timestamp)}`
          : 'No temperature sensor at this location yet'
        }
      </div>
    </div>
  `;
}

function LakeLayer({ map, visible }: LakeLayerProps) {
  const [lakes, setLakes] = useState<LakeTemperature[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);

  // Fetch lake data on mount and every 15 minutes
  useEffect(() => {
    if (!map) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchLakeTemperatures();
        setLakes(data);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to load lake temperatures:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 15 minutes (matches USGS update frequency)
    const interval = setInterval(fetchData, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [map]);

  // Update markers when lakes data or visibility changes
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(({ marker, element, handler }) => {
      element.removeEventListener('click', handler);
      marker.remove();
    });
    markersRef.current = [];

    // Don't create markers if layer is hidden
    if (!visible) return;

    // Create markers for each lake
    lakes.forEach((lake) => {
      const el = createLakeMarker(lake);
      const popupHTML = createPopupHTML(lake);

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: true,
        maxWidth: '320px',
      }).setHTML(popupHTML);

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([lake.longitude, lake.latitude])
        .setPopup(popup)
        .addTo(map);

      // Store click handler so we can remove it later
      const handler = (e: MouseEvent) => {
        e.stopPropagation();
        marker.togglePopup();
      };

      el.addEventListener('click', handler);

      markersRef.current.push({ marker, element: el, handler });
    });

    return () => {
      markersRef.current.forEach(({ marker, element, handler }) => {
        element.removeEventListener('click', handler);
        marker.remove();
      });
      markersRef.current = [];
    };
  }, [map, lakes, visible]);

  return null;
}

export default memo(LakeLayer);
