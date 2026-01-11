/**
 * Icon components for travel incidents
 * Using Lucide icons for consistency
 */

import { getIncidentColor } from './incidentColors';

/**
 * Get Lucide SVG icon for incident type
 * These match the icons used in the TravelLayer component
 * @param {string} type - Incident type
 * @param {number} size - Icon size in pixels
 * @returns {string} SVG markup
 */
export function getIncidentIcon(type, size = 20) {
  const color = getIncidentColor(type).primary;
  const strokeWidth = 2.5;

  const icons = {
    // AlertTriangle - for accidents
    ACCIDENT: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
      </svg>
    `,
    // Construction - for construction
    CONSTRUCTION: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
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
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m4.9 4.9 14.2 14.2"/>
      </svg>
    `,
    // Waves - for flooding
    FLOODING: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      </svg>
    `,
    // AlertOctagon - for hazards
    HAZARD: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/>
        <path d="M12 8v4"/>
        <path d="M12 16h.01"/>
      </svg>
    `
  };

  return icons[type] || icons.HAZARD;
}

/**
 * Create a marker icon as an HTML element for MapLibre
 * @param {string} type - Incident type
 * @returns {HTMLElement} Marker element
 */
export function createMarkerElement(type) {
  const el = document.createElement('div');
  el.className = 'incident-marker';
  el.dataset.type = type.toLowerCase();

  const color = getIncidentColor(type);

  el.innerHTML = `
    <div class="marker-circle" style="
      background: white;
      border: 2px solid ${color.primary};
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    ">
      ${getIncidentIcon(type, 16)}
    </div>
  `;

  // Add hover effect
  el.addEventListener('mouseenter', () => {
    const circle = el.querySelector('.marker-circle');
    circle.style.transform = 'scale(1.1)';
    circle.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  });

  el.addEventListener('mouseleave', () => {
    const circle = el.querySelector('.marker-circle');
    circle.style.transform = 'scale(1)';
    circle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  });

  return el;
}

/**
 * Get icon name for incident type (for UI display)
 * @param {string} type - Incident type
 * @returns {string} Human-readable icon description
 */
export function getIncidentIconName(type) {
  const names = {
    ACCIDENT: 'alert-triangle',
    CONSTRUCTION: 'hard-hat',
    CLOSURE: 'ban',
    FLOODING: 'waves',
    HAZARD: 'alert-octagon'
  };

  return names[type] || 'alert-octagon';
}
