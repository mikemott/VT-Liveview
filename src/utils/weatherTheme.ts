/**
 * Weather Theme Utilities
 * Determines adaptive UI theme based on current weather conditions
 */

export type WeatherTheme = 'sunny' | 'rainy' | 'snowy' | 'severe' | 'default';

/**
 * Determines weather theme from weather description and alert severity
 * @param description - Current weather description from NOAA
 * @param hasSevereAlert - Whether there's an active severe/extreme alert
 * @returns Weather theme identifier
 */
export function getWeatherTheme(
  description: string | null | undefined,
  hasSevereAlert: boolean = false
): WeatherTheme {
  if (!description) return 'default';

  const desc = description.toLowerCase();

  // Severe weather takes priority
  if (hasSevereAlert) {
    return 'severe';
  }

  // Check for severe weather conditions in description
  if (
    desc.includes('severe') ||
    desc.includes('extreme') ||
    desc.includes('tornado') ||
    desc.includes('hurricane') ||
    desc.includes('thunderstorm') ||
    desc.includes('lightning')
  ) {
    return 'severe';
  }

  // Snow conditions
  if (
    desc.includes('snow') ||
    desc.includes('blizzard') ||
    desc.includes('flurries') ||
    desc.includes('sleet') ||
    desc.includes('ice') ||
    desc.includes('freezing')
  ) {
    return 'snowy';
  }

  // Rain conditions
  if (
    desc.includes('rain') ||
    desc.includes('drizzle') ||
    desc.includes('shower') ||
    desc.includes('precipitation')
  ) {
    return 'rainy';
  }

  // Partly cloudy defaults to sunny (check before cloudy to avoid shadowing)
  if (desc.includes('partly')) {
    return 'sunny';
  }

  // Cloudy/overcast (use rainy theme with muted colors)
  if (
    desc.includes('cloudy') ||
    desc.includes('overcast') ||
    desc.includes('fog') ||
    desc.includes('mist')
  ) {
    return 'rainy';
  }

  // Clear/sunny conditions
  if (
    desc.includes('clear') ||
    desc.includes('sunny') ||
    desc.includes('fair')
  ) {
    return 'sunny';
  }

  return 'default';
}

/**
 * Apply weather theme to the document root
 * @param theme - Weather theme to apply
 */
export function applyWeatherTheme(theme: WeatherTheme): void {
  // Guard against DOM unavailability (e.g., SSR, Node.js contexts)
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }

  const root = document.documentElement;

  // Remove all weather theme classes
  root.classList.remove('weather-sunny', 'weather-rainy', 'weather-snowy', 'weather-severe');

  // Apply new theme class (if not default)
  if (theme !== 'default') {
    root.classList.add(`weather-${theme}`);
  }
}

/**
 * Check if there are severe or extreme alerts
 * @param alerts - Array of alert features
 * @returns true if any severe/extreme alerts exist
 */
export function hasSevereAlerts(alerts: Array<{ properties?: { severity?: string } }>): boolean {
  return alerts.some(alert =>
    alert.properties?.severity === 'Severe' ||
    alert.properties?.severity === 'Extreme'
  );
}
