import { memo, useMemo } from 'react';

// Vite glob import - loads all SVG icons from Meteocons line style
// This creates a module map at build time using the @weather-icons alias
const lineIcons = import.meta.glob(
  '@weather-icons/line/all/*.svg',
  { eager: true, as: 'url' }
);

const fillIcons = import.meta.glob(
  '@weather-icons/fill/all/*.svg',
  { eager: true, as: 'url' }
);

/**
 * WeatherIcon component - wrapper for Meteocons animated SVG weather icons
 *
 * @param {string} name - Icon name (e.g., 'clear-day', 'sleet', 'partly-cloudy-day-rain')
 * @param {number} size - Icon size in pixels (default: 48)
 * @param {string} style - Icon style: 'line' or 'fill' (default: 'line')
 */
const WeatherIcon = memo(({ name, size = 48, style = 'line' }) => {
  const iconUrl = useMemo(() => {
    if (!name) return null;

    const icons = style === 'fill' ? fillIcons : lineIcons;
    const iconPath = `@weather-icons/${style}/all/${name}.svg`;

    return icons[iconPath] || null;
  }, [name, style]);

  if (!iconUrl) {
    if (import.meta.env.DEV) {
      console.warn(`Weather icon not found: ${name} (style: ${style})`);
    }
    return null;
  }

  return (
    <img
      src={iconUrl}
      alt={name}
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  );
});

WeatherIcon.displayName = 'WeatherIcon';

export default WeatherIcon;
