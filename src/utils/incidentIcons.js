/**
 * Icon components for travel incidents
 * Using inline SVG icons in Lucide style (outlined/stroke)
 */

import { getIncidentColor } from './incidentColors';

/**
 * Create an SVG icon element for a given incident type
 * @param {string} type - Incident type
 * @param {number} size - Icon size in pixels
 * @returns {string} SVG markup
 */
export function getIncidentIcon(type, size = 20) {
  const color = getIncidentColor(type).primary;
  const icons = {
    ACCIDENT: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    `,
    CONSTRUCTION: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l7-5H4L2 8Z"/>
        <path d="M7 3v5"/>
        <path d="M12 3v5"/>
        <path d="M17 3v5"/>
      </svg>
    `,
    CLOSURE: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m4.93 4.93 14.14 14.14"/>
      </svg>
    `,
    FLOODING: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      </svg>
    `,
    HAZARD: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
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
