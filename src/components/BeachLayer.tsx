import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchRecreationSites } from '../services/recreationApi';
import type { RecreationSite } from '../services/recreationApi';
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

// =============================================================================
// Icon & Colors
// =============================================================================

const WAVES_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  </svg>
`;

const BEACH_COLOR = '#3b82f6'; // Blue - matches water theme

// =============================================================================
// Marker Creation
// =============================================================================

function createBeachMarker(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'beach-marker';

  el.style.cssText = `
    width: 32px;
    height: 32px;
    background: ${BEACH_COLOR};
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
    el.style.boxShadow = `0 0 12px ${BEACH_COLOR}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}

// =============================================================================
// Popup HTML Generation
// =============================================================================

function createPopupHTML(site: RecreationSite): string {
  const safeName = escapeHTML(site.name);
  const safeAddress = site.address ? escapeHTML(site.address) : null;
  const safeTown = site.town ? escapeHTML(site.town) : null;
  const safePhone = site.phone ? escapeHTML(site.phone) : null;
  const safeOrg = site.organization ? escapeHTML(site.organization) : null;

  let amenitiesHTML = '';

  // Swimming amenities
  if (site.amenities.swimming) {
    const s = site.amenities.swimming;
    amenitiesHTML += '<div class="amenity-section">';
    amenitiesHTML += '<h4>🏊 Swimming & Beach</h4>';
    amenitiesHTML += '<div class="amenity-grid">';
    if (s.hasBeach) amenitiesHTML += '<div>🏖️ Beach access</div>';
    if (s.lakeSwimming) amenitiesHTML += '<div>🌊 Lake swimming</div>';
    if (s.poolSwimming) amenitiesHTML += '<div>🏊 Swimming pool</div>';
    if (s.riverSwimming) amenitiesHTML += '<div>🏞️ River swimming</div>';
    if (s.waterBodyName) amenitiesHTML += `<div class="water-name">📍 ${escapeHTML(s.waterBodyName)}</div>`;
    amenitiesHTML += '</div>';
    amenitiesHTML += '</div>';
  }

  // Camping amenities (if mixed site)
  if (site.amenities.camping) {
    const c = site.amenities.camping;
    const totalSites = c.tentSites + c.rvSites + c.shelters;

    amenitiesHTML += '<div class="amenity-section amenity-bonus">';
    amenitiesHTML += '<h4>⛺ Also Available: Camping</h4>';
    amenitiesHTML += '<div class="amenity-grid">';
    if (c.tentSites > 0) amenitiesHTML += `<div>🏕️ ${c.tentSites} tent sites</div>`;
    if (c.rvSites > 0) amenitiesHTML += `<div>🚐 ${c.rvSites} RV sites</div>`;
    if (c.shelters > 0) amenitiesHTML += `<div>🏡 ${c.shelters} shelters</div>`;
    if (totalSites > 0) amenitiesHTML += `<div class="total-sites-inline">Total: ${totalSites} sites</div>`;
    amenitiesHTML += '</div>';
    amenitiesHTML += '</div>';
  }

  // Other amenities
  const otherAmenities = [];
  if (site.amenities.boatRental) otherAmenities.push('⛵ Boat rental');
  if (site.amenities.picnicArea) otherAmenities.push('🧺 Picnic area');
  if (site.amenities.playground) otherAmenities.push('🎪 Playground');

  if (otherAmenities.length > 0) {
    amenitiesHTML += '<div class="amenity-section">';
    amenitiesHTML += '<h4>Additional Amenities</h4>';
    amenitiesHTML += '<div class="amenity-grid">';
    otherAmenities.forEach(a => {
      amenitiesHTML += `<div>${a}</div>`;
    });
    amenitiesHTML += '</div>';
    amenitiesHTML += '</div>';
  }

  return `
    <div class="beach-popup-content">
      <h3>${safeName}</h3>
      <div class="site-info">
        ${safeOrg ? `<div class="operator">${safeOrg}</div>` : ''}
        ${safeAddress ? `<div class="address">${safeAddress}</div>` : ''}
        ${safeTown ? `<div class="town">${safeTown}</div>` : ''}
        ${safePhone ? `<div class="phone">📞 ${safePhone}</div>` : ''}
        <div class="access">${site.isPublic ? '🌊 Public' : '🏢 Private'}</div>
        ${site.acreage ? `<div class="acreage">📏 ${site.acreage} acres</div>` : ''}
        ${site.parkingSpaces ? `<div class="parking">🅿️ ${site.parkingSpaces} spaces</div>` : ''}
      </div>
      ${amenitiesHTML}
    </div>
  `;
}

// =============================================================================
// Component
// =============================================================================

function BeachLayer({ map, visible }: BeachLayerProps) {
  const [sites, setSites] = useState<RecreationSite[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);

  // Fetch sites on mount and filter for beaches
  useEffect(() => {
    if (!map) return;

    const fetchSites = async (): Promise<void> => {
      if (!map) return;

      setLoading(true);
      try {
        const data = await fetchRecreationSites();
        // Filter for beach and mixed sites only
        const beachSites = data.filter(site =>
          site.type === 'beach' || site.type === 'mixed'
        );
        setSites(beachSites);
      } catch (error) {
        // Silently fail - beach data is non-critical
        if (import.meta.env.DEV) {
          console.error('Error fetching beach sites:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, [map]);

  // Add markers to map when sites change
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

    // Add new markers for beach sites
    sites.forEach((site) => {
      const el = createBeachMarker();

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([site.longitude, site.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'beach-popup',
          maxWidth: '360px',
        })
          .setLngLat([site.longitude, site.latitude])
          .setHTML(createPopupHTML(site))
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
  }, [map, visible, sites]);

  // No UI panel - markers only
  return null;
}

export default memo(BeachLayer);
