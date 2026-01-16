import { memo, useMemo } from 'react';

// Vite glob import - loads all SVG icons from Meteocons line style
// This creates a module map at build time
const lineIcons = import.meta.glob(
  '/node_modules/@bybas/weather-icons/production/line/all/*.svg',
  { eager: true, as: 'url' }
);

const fillIcons = import.meta.glob(
  '/node_modules/@bybas/weather-icons/production/fill/all/*.svg',
  { eager: true, as: 'url' }
);

interface WeatherIconProps {
  /** Icon name (e.g., 'clear-day', 'sleet', 'partly-cloudy-day-rain') */
  name: string;
  /** Icon size in pixels (default: 48) */
  size?: number;
  /** Icon style: 'line' or 'fill' (default: 'line') */
  style?: 'line' | 'fill';
}

/**
 * WeatherIcon component - wrapper for Meteocons animated SVG weather icons
 */
const WeatherIcon = memo<WeatherIconProps>(({ name, size = 48, style = 'line' }) => {
  const iconUrl = useMemo(() => {
    if (!name) return null;

    const icons = style === 'fill' ? fillIcons : lineIcons;
    const iconPath = `/node_modules/@bybas/weather-icons/production/${style}/all/${name}.svg`;

    return (icons[iconPath] as string) || null;
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
