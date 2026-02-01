/**
 * Icon components for travel incidents
 * Using Lucide-style SVG icons for consistency
 */

import type { IncidentType } from '@/types';

// =============================================================================
// SVG Icon Generation
// =============================================================================

/** Icon name mapping for display purposes */
type IncidentIconName =
  | 'alert-triangle'
  | 'hard-hat'
  | 'ban'
  | 'waves'
  | 'alert-octagon';

/** Map of incident types to icon names */
const ICON_NAMES: Record<IncidentType, IncidentIconName> = {
  ACCIDENT: 'alert-triangle',
  CONSTRUCTION: 'hard-hat',
  CLOSURE: 'ban',
  FLOODING: 'waves',
  HAZARD: 'alert-octagon',
};

/**
 * Get Lucide SVG icon for incident type
 * These match the icons used in the TravelLayer component
 * @param type - Incident type
 * @param size - Icon size in pixels
 * @param color - Optional color override (defaults to category text color for chips)
 * @returns SVG markup string
 */
export function getIncidentIcon(type: IncidentType, size = 20, color?: string): string {
  const iconColor = color || getCategoryColors(type).iconColor;
  const strokeWidth = 2.5;

  const icons: Record<IncidentType, string> = {
    // AlertTriangle - for accidents
    ACCIDENT: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
      </svg>
    `,
    // Construction - for construction
    CONSTRUCTION: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="6" width="20" height="8" rx="1"/>
        <path d="M17 14v7"/>
        <path d="M7 14v7"/>
        <path d="M17 3v3"/>
        <path d="M7 3v3"/>
        <path d="M10 14 2.3 6.3"/>
        <path d="m14 6 7.7 7.7"/>
        <path d="m8 6 8 8"/>
      </svg>
    `,
    // Ban - for closures
    CLOSURE: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m4.9 4.9 14.2 14.2"/>
      </svg>
    `,
    // Waves - for flooding
    FLOODING: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      </svg>
    `,
    // AlertOctagon - for hazards
    HAZARD: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/>
        <path d="M12 8v4"/>
        <path d="M12 16h.01"/>
      </svg>
    `,
  };

  return icons[type] ?? icons.HAZARD;
}

// =============================================================================
// DOM Element Creation
// =============================================================================

/**
 * Get category-specific colors for map markers
 * Vibrant, eye-catching colors for visibility on map
 */
function getCategoryColors(type: IncidentType): { bg: string; border: string; shadow: string; iconColor: string } {
  const categoryColors: Record<IncidentType, { bg: string; border: string; shadow: string; iconColor: string }> = {
    ACCIDENT: {
      bg: '#cc6652', // Vibrant terracotta red
      border: '#ffffff', // White border for contrast
      shadow: 'rgba(0, 0, 0, 0.3)',
      iconColor: '#ffffff' // White icon
    },
    CONSTRUCTION: {
      bg: '#daa520', // Vibrant goldenrod
      border: '#ffffff',
      shadow: 'rgba(0, 0, 0, 0.3)',
      iconColor: '#ffffff'
    },
    CLOSURE: {
      bg: '#db7093', // Vibrant rose pink
      border: '#ffffff',
      shadow: 'rgba(0, 0, 0, 0.3)',
      iconColor: '#ffffff'
    },
    FLOODING: {
      bg: '#489d99', // Vibrant teal
      border: '#ffffff',
      shadow: 'rgba(0, 0, 0, 0.3)',
      iconColor: '#ffffff'
    },
    HAZARD: {
      bg: '#d67e2c', // Vibrant burnt orange
      border: '#ffffff',
      shadow: 'rgba(0, 0, 0, 0.3)',
      iconColor: '#ffffff'
    }
  };
  return categoryColors[type] || categoryColors.HAZARD;
}

/**
 * Create a marker icon as an HTML element for MapLibre
 * Styled to match filter chip design with embossed effect
 * Note: innerHTML is safe here as all content comes from hardcoded SVG strings
 * @param type - Incident type
 * @returns Marker HTML element with hover effects
 */
export function createMarkerElement(type: IncidentType): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'incident-marker';
  el.dataset.type = type.toLowerCase();

  const colors = getCategoryColors(type);

  // Build marker structure - content is from trusted hardcoded sources only
  const circleDiv = document.createElement('div');
  circleDiv.className = 'marker-circle';
  circleDiv.style.cssText = `
    background: ${colors.bg};
    border: 3px solid ${colors.border};
    border-radius: 50%;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 8px ${colors.shadow};
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  // SVG content is hardcoded in getIncidentIcon, not from external sources
  const svgContent = getIncidentIcon(type, 16);
  const template = document.createElement('template');
  template.innerHTML = svgContent.trim();
  const svgElement = template.content.firstChild;
  if (svgElement) {
    circleDiv.appendChild(svgElement);
  }

  el.appendChild(circleDiv);

  // Add hover effect
  el.addEventListener('mouseenter', () => {
    circleDiv.style.transform = 'translateY(-2px) scale(1.1)';
    circleDiv.style.boxShadow = `0 5px 12px ${colors.shadow}`;
  });

  el.addEventListener('mouseleave', () => {
    circleDiv.style.transform = 'translateY(0) scale(1)';
    circleDiv.style.boxShadow = `0 3px 8px ${colors.shadow}`;
  });

  return el;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get icon name for incident type (for UI display)
 * @param type - Incident type
 * @returns Human-readable icon name
 */
export function getIncidentIconName(type: IncidentType): IncidentIconName {
  return ICON_NAMES[type] ?? 'alert-octagon';
}
