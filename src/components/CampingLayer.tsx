import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchRecreationSites } from '../services/recreationApi';
import { fetchBackcountrySites } from '../services/backcountryApi';
import type { RecreationSite } from '../services/recreationApi';
import type { BackcountrySite } from '../services/backcountryApi';
import { escapeHTML } from '../utils/sanitize';
import type { MapLibreMap, Marker } from '../types';
import './CampingLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface CampingLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  showCampgrounds: boolean;
  showBackcountry: boolean;
  onCountsChange?: (campgroundCount: number, backcountryCount: number) => void;
}

// =============================================================================
// Icons & Colors
// =============================================================================

const TENT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 21 14 3"/>
    <path d="M20.5 21 10 3"/>
    <path d="M15.5 21 12 15l-3.5 6"/>
    <line x1="2" x2="22" y1="21" y2="21"/>
  </svg>
`;

const CAMPFIRE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
`;

const CAMPGROUND_COLOR = '#10b981'; // Green - for campgrounds
const BACKCOUNTRY_COLOR = '#92400e'; // Brown - for backcountry sites

// =============================================================================
// Marker Creation
// =============================================================================

function createCampgroundMarker(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'camping-marker campground-marker';

  el.style.cssText = `
    width: 32px;
    height: 32px;
    background: ${CAMPGROUND_COLOR};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
  `;

  el.innerHTML = TENT_ICON;

  // Hover glow effect
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${CAMPGROUND_COLOR}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}

function createBackcountryMarker(siteType: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'camping-marker backcountry-marker';

  // Choose icon based on site type
  const isLeanTo = siteType.toLowerCase().includes('lean-to');
  const icon = isLeanTo ? TENT_ICON : CAMPFIRE_ICON;

  // Size based on type (lean-tos slightly larger)
  const size = isLeanTo ? 26 : 22;

  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    background: ${BACKCOUNTRY_COLOR};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  el.innerHTML = icon;

  // Hover effect
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${BACKCOUNTRY_COLOR}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.transform = 'scale(1.15)';
    el.style.zIndex = '1000';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.transform = 'scale(1)';
    el.style.zIndex = '';
  });

  return el;
}

// =============================================================================
// Popup HTML Generation
// =============================================================================

function createCampgroundPopupHTML(site: RecreationSite): string {
  const safeName = escapeHTML(site.name);
  const safeAddress = site.address ? escapeHTML(site.address) : null;
  const safeTown = site.town ? escapeHTML(site.town) : null;
  const safePhone = site.phone ? escapeHTML(site.phone) : null;
  const safeOrg = site.organization ? escapeHTML(site.organization) : null;

  let amenitiesHTML = '';

  // Camping amenities
  if (site.amenities.camping) {
    const c = site.amenities.camping;
    const totalSites = c.tentSites + c.rvSites + c.shelters;

    amenitiesHTML += '<div class="amenity-section">';
    amenitiesHTML += '<h4>⛺ Camping Facilities</h4>';
    amenitiesHTML += '<div class="amenity-grid">';
    if (c.tentSites > 0) amenitiesHTML += `<div>🏕️ Tent sites: ${c.tentSites}</div>`;
    if (c.rvSites > 0) amenitiesHTML += `<div>🚐 RV sites: ${c.rvSites}</div>`;
    if (c.shelters > 0) amenitiesHTML += `<div>🏡 Shelters: ${c.shelters}</div>`;
    if (c.hookups.electric > 0) amenitiesHTML += `<div>⚡ Electric: ${c.hookups.electric}</div>`;
    if (c.hookups.water > 0) amenitiesHTML += `<div>💧 Water: ${c.hookups.water}</div>`;
    if (c.hookups.both > 0) amenitiesHTML += `<div>⚡💧 Full hookup: ${c.hookups.both}</div>`;
    if (c.groupCamping) amenitiesHTML += '<div>👥 Group camping</div>';
    if (c.primitiveCamping) amenitiesHTML += '<div>🌲 Primitive sites</div>';
    if (c.winterCamping) amenitiesHTML += '<div>❄️ Winter camping</div>';
    amenitiesHTML += '</div>';
    amenitiesHTML += `<div class="total-sites">Total sites: ${totalSites}</div>`;
    amenitiesHTML += '</div>';
  }

  // Swimming amenities (if mixed site)
  if (site.amenities.swimming) {
    const s = site.amenities.swimming;
    amenitiesHTML += '<div class="amenity-section amenity-bonus">';
    amenitiesHTML += '<h4>🏊 Also Available: Swimming</h4>';
    amenitiesHTML += '<div class="amenity-grid">';
    if (s.hasBeach) amenitiesHTML += '<div>🏖️ Beach</div>';
    if (s.lakeSwimming) amenitiesHTML += '<div>🌊 Lake swimming</div>';
    if (s.poolSwimming) amenitiesHTML += '<div>🏊 Pool</div>';
    if (s.riverSwimming) amenitiesHTML += '<div>🏞️ River swimming</div>';
    if (s.waterBodyName) amenitiesHTML += `<div>📍 ${escapeHTML(s.waterBodyName)}</div>`;
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
    <div class="camping-popup-content">
      <h3>${safeName}</h3>
      <div class="site-type-badge campground-badge">Campground</div>
      <div class="site-info">
        ${safeOrg ? `<div class="operator">${safeOrg}</div>` : ''}
        ${safeAddress ? `<div class="address">${safeAddress}</div>` : ''}
        ${safeTown ? `<div class="town">${safeTown}</div>` : ''}
        ${safePhone ? `<div class="phone">📞 ${safePhone}</div>` : ''}
        <div class="access">${site.isPublic ? '🌲 Public' : '🏢 Private'}</div>
        ${site.acreage ? `<div class="acreage">📏 ${site.acreage} acres</div>` : ''}
        ${site.parkingSpaces ? `<div class="parking">🅿️ ${site.parkingSpaces} spaces</div>` : ''}
      </div>
      ${amenitiesHTML}
    </div>
  `;
}

function createBackcountryPopupHTML(site: BackcountrySite): string {
  const safeSiteId = escapeHTML(site.siteId);
  const safeSiteType = escapeHTML(site.siteType);
  const safeNotes = site.notes ? escapeHTML(site.notes) : null;

  // Determine icon based on site type
  const siteIcon = safeSiteType.toLowerCase().includes('lean-to') ? '⛺' :
                   safeSiteType.toLowerCase().includes('cabin') || safeSiteType.toLowerCase().includes('cottage') ? '🏠' :
                   safeSiteType.toLowerCase().includes('shelter') ? '🛖' : '🏕️';

  // Build features list
  const features = [];
  if (site.hasFirePit) features.push({ icon: '🔥', label: 'Fire pit available' });
  if (site.hasPicnicTable) features.push({ icon: '🪑', label: 'Picnic table' });
  if (site.isAccessible) features.push({ icon: '♿', label: 'ADA accessible' });

  let featuresHTML = '';
  if (features.length > 0) {
    featuresHTML = '<div class="backcountry-features">';
    features.forEach(f => {
      featuresHTML += `<div class="feature-item"><span class="feature-icon">${f.icon}</span><span>${f.label}</span></div>`;
    });
    featuresHTML += '</div>';
  }

  // Info about what to expect
  let infoHTML = '<div class="backcountry-info">';
  if (safeSiteType.toLowerCase().includes('lean-to')) {
    infoHTML += '<div class="info-item">📍 Three-sided shelter, typically sleeps 4-8 people</div>';
  } else if (safeSiteType.toLowerCase().includes('tent site')) {
    infoHTML += '<div class="info-item">📍 Designated tent camping area</div>';
  } else if (safeSiteType.toLowerCase().includes('cabin') || safeSiteType.toLowerCase().includes('cottage')) {
    infoHTML += '<div class="info-item">📍 Enclosed shelter with amenities</div>';
  }

  if (!site.hasFirePit && !site.hasPicnicTable && !site.isAccessible) {
    infoHTML += '<div class="info-item">ℹ️ Primitive site - bring all supplies</div>';
  }
  infoHTML += '</div>';

  return `
    <div class="camping-popup-content backcountry-popup">
      <div class="popup-header">
        <span class="site-icon">${siteIcon}</span>
        <div class="header-text">
          <h3>${safeSiteId}</h3>
          <div class="site-type-badge backcountry-badge">${safeSiteType}</div>
        </div>
      </div>
      ${safeNotes ? `<div class="site-notes">${safeNotes}</div>` : ''}
      ${featuresHTML}
      ${infoHTML}
      <div class="popup-footer">
        <span class="footer-note">🌲 Vermont State Parks backcountry site</span>
      </div>
    </div>
  `;
}

// =============================================================================
// Component
// =============================================================================

function CampingLayer({ map, visible, showCampgrounds, showBackcountry, onCountsChange }: CampingLayerProps) {
  const [campgrounds, setCampgrounds] = useState<RecreationSite[]>([]);
  const [backcountrySites, setBackcountrySites] = useState<BackcountrySite[]>([]);
  const [_loading, setLoading] = useState(false);

  const campgroundMarkersRef = useRef<MarkerEntry[]>([]);
  const backcountryMarkersRef = useRef<MarkerEntry[]>([]);

  // Fetch both types of sites on mount
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('CampingLayer: useEffect triggered', { map: !!map, visible });
    }

    if (!map) return;

    const fetchSites = async (): Promise<void> => {
      if (!map) return;

      if (import.meta.env.DEV) {
        console.log('CampingLayer: Starting fetch for camping sites...');
      }

      setLoading(true);
      try {
        // Fetch campgrounds (recreation sites filtered for camping)
        const recreationData = await fetchRecreationSites();
        const campingData = recreationData.filter(site =>
          site.type === 'camping' || site.type === 'mixed'
        );
        setCampgrounds(campingData);

        if (import.meta.env.DEV) {
          console.log(`CampingLayer: Fetched ${campingData.length} campgrounds`);
        }

        // Fetch backcountry sites
        if (import.meta.env.DEV) {
          console.log('CampingLayer: Fetching backcountry sites...');
        }
        const backcountryData = await fetchBackcountrySites();
        setBackcountrySites(backcountryData);

        if (import.meta.env.DEV) {
          console.log(`CampingLayer: Fetched ${backcountryData.length} backcountry sites`);
        }

        // Notify parent of counts
        if (onCountsChange) {
          onCountsChange(campingData.length, backcountryData.length);
        }
      } catch (error) {
        // Log error in dev mode
        if (import.meta.env.DEV) {
          console.error('CampingLayer: Error fetching camping sites:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, [map, onCountsChange]);

  // Manage campground markers (non-clustered)
  useEffect(() => {
    if (!map || !visible || !showCampgrounds) {
      // Clear existing markers
      campgroundMarkersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      campgroundMarkersRef.current = [];
      return;
    }

    // Remove old markers
    campgroundMarkersRef.current.forEach(({ marker, element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler as EventListener);
      }
      marker.remove();
    });
    campgroundMarkersRef.current = [];

    // Add new markers for campgrounds
    campgrounds.forEach((site) => {
      const el = createCampgroundMarker();

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([site.longitude, site.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'camping-popup',
          maxWidth: '360px',
        })
          .setLngLat([site.longitude, site.latitude])
          .setHTML(createCampgroundPopupHTML(site))
          .addTo(map);
      };

      el.addEventListener('click', handleMarkerClick as EventListener);

      campgroundMarkersRef.current.push({
        marker: marker as Marker,
        element: el,
        handler: handleMarkerClick,
      });
    });

    // Cleanup
    return () => {
      campgroundMarkersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      campgroundMarkersRef.current = [];
    };
  }, [map, visible, showCampgrounds, campgrounds]);

  // Manage backcountry markers (individual, non-clustered)
  useEffect(() => {
    if (!map || !visible || !showBackcountry) {
      // Clear existing markers
      backcountryMarkersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      backcountryMarkersRef.current = [];
      return;
    }

    // Remove old markers
    backcountryMarkersRef.current.forEach(({ marker, element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler as EventListener);
      }
      marker.remove();
    });
    backcountryMarkersRef.current = [];

    // Add new markers for backcountry sites
    backcountrySites.forEach((site) => {
      const el = createBackcountryMarker(site.siteType);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([site.longitude, site.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'camping-popup backcountry-popup',
          maxWidth: '340px',
        })
          .setLngLat([site.longitude, site.latitude])
          .setHTML(createBackcountryPopupHTML(site))
          .addTo(map);
      };

      el.addEventListener('click', handleMarkerClick as EventListener);

      backcountryMarkersRef.current.push({
        marker: marker as Marker,
        element: el,
        handler: handleMarkerClick,
      });
    });

    // Cleanup
    return () => {
      backcountryMarkersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      backcountryMarkersRef.current = [];
    };
  }, [map, visible, showBackcountry, backcountrySites]);

  // No UI rendered - controlled by parent (TravelLayer)
  return null;
}

export default memo(CampingLayer);
