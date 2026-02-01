/**
 * Weather Icon Mapping Utility
 *
 * Maps NOAA weather data to Meteocons icon names.
 * Supports both icon URL parsing (preferred) and text description fallback.
 */

/**
 * Parse NOAA icon URL to extract weather condition codes
 * @param iconUrl - NOAA icon URL (e.g., "https://api.weather.gov/icons/land/day/snow,20/sct?size=medium")
 * @returns Object with isNight boolean and array of weather codes
 */
function parseNOAAIconUrl(iconUrl: string): { isNight: boolean; codes: string[] } {
  try {
    // Extract path from URL: /icons/land/day/snow,20/sct
    const url = new URL(iconUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Find day/night indicator
    const dayIndex = pathParts.indexOf('day');
    const nightIndex = pathParts.indexOf('night');
    const timeIndex = dayIndex !== -1 ? dayIndex : nightIndex;

    // Early return if neither day nor night found
    if (timeIndex === -1) {
      if (import.meta.env.DEV) {
        console.warn('NOAA icon URL missing day/night indicator:', iconUrl);
      }
      return { isNight: false, codes: [] };
    }

    const isNight = pathParts[timeIndex] === 'night';

    // Weather codes are after day/night
    const codes = pathParts.slice(timeIndex + 1).map(code => {
      // Remove probability percentages (e.g., "snow,20" -> "snow")
      return code.split(',')[0] ?? '';
    }).filter(code => code !== '');

    return { isNight, codes };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to parse NOAA icon URL:', iconUrl, error);
    }
    return { isNight: false, codes: [] };
  }
}

/**
 * Map NOAA weather codes to Meteocons icon name
 * @param iconUrl - NOAA icon URL
 * @returns Meteocons icon name
 */
export function getWeatherIconFromNOAAUrl(iconUrl: string | null | undefined): string {
  if (!iconUrl) {
    return 'clear-day';
  }

  const { isNight, codes } = parseNOAAIconUrl(iconUrl);
  const timePrefix = isNight ? 'night' : 'day';

  // Primary weather code is the first one (or most significant)
  const primaryCode = codes[0] || '';
  const secondaryCode = codes[1] || '';

  // NOAA Code to Meteocons mapping
  // Reference: https://api.weather.gov/icons

  // Severe weather (no day/night variants)
  if (primaryCode === 'tornado') return 'tornado';
  if (primaryCode === 'hurricane' || primaryCode === 'tropical_storm') return 'hurricane';
  if (primaryCode === 'blizzard') return 'snow'; // Meteocons doesn't have blizzard

  // Thunderstorms
  if (primaryCode === 'tsra' || primaryCode === 'tsra_sct' || primaryCode === 'tsra_hi') {
    if (secondaryCode === 'snow') return `thunderstorms-${timePrefix}-snow`;
    if (secondaryCode === 'rain' || secondaryCode === 'rain_showers') return `thunderstorms-${timePrefix}-rain`;
    return `thunderstorms-${timePrefix}`;
  }

  // Precipitation types
  if (primaryCode === 'rain_snow' || primaryCode === 'snow_rain') {
    return 'sleet'; // Mixed precip = sleet
  }
  if (primaryCode === 'rain_sleet' || primaryCode === 'snow_sleet') {
    return 'sleet';
  }
  if (primaryCode === 'fzra' || primaryCode === 'rain_fzra' || primaryCode === 'snow_fzra') {
    return 'sleet'; // Freezing rain shows as sleet
  }

  // Snow
  if (primaryCode === 'snow') {
    // Check cloud cover from secondary code
    if (secondaryCode === 'few' || secondaryCode === 'sct') {
      return `partly-cloudy-${timePrefix}-snow`;
    }
    return 'snow';
  }

  // Rain
  if (primaryCode === 'rain' || primaryCode === 'rain_showers' || primaryCode === 'rain_showers_hi') {
    // Check cloud cover from secondary code
    if (secondaryCode === 'few' || secondaryCode === 'sct') {
      return `partly-cloudy-${timePrefix}-rain`;
    }
    if (secondaryCode === 'bkn' || secondaryCode === 'ovc') {
      return `partly-cloudy-${timePrefix}-rain`; // Use partly-cloudy for consistency
    }
    return 'rain';
  }

  // Sleet
  if (primaryCode === 'sleet') {
    if (secondaryCode === 'few' || secondaryCode === 'sct') {
      return `partly-cloudy-${timePrefix}-sleet`;
    }
    return 'sleet';
  }

  // Atmospheric conditions
  if (primaryCode === 'fog') return `fog-${timePrefix}`;
  if (primaryCode === 'haze') return `haze-${timePrefix}`;
  if (primaryCode === 'smoke') return `smoke-${timePrefix}`;
  if (primaryCode === 'dust') return `dust-${timePrefix}`;

  // Cloud cover (when no precip)
  if (primaryCode === 'skc') return `clear-${timePrefix}`;
  if (primaryCode === 'few') return `partly-cloudy-${timePrefix}`;
  if (primaryCode === 'sct') return `partly-cloudy-${timePrefix}`;
  if (primaryCode === 'bkn') return `overcast-${timePrefix}`;
  if (primaryCode === 'ovc') return `overcast-${timePrefix}`;

  // Wind variants (use cloud cover equivalent)
  if (primaryCode.startsWith('wind_')) {
    const baseCode = primaryCode.replace('wind_', '');
    if (baseCode === 'skc') return `clear-${timePrefix}`;
    if (baseCode === 'few' || baseCode === 'sct') return `partly-cloudy-${timePrefix}`;
    if (baseCode === 'bkn' || baseCode === 'ovc') return `overcast-${timePrefix}`;
  }

  // Hot/cold (use clear as fallback)
  if (primaryCode === 'hot' || primaryCode === 'cold') {
    return `clear-${timePrefix}`;
  }

  // Fallback
  if (import.meta.env.DEV) {
    console.warn(`Unknown NOAA weather code: ${primaryCode}, secondary: ${secondaryCode}`);
  }
  return isNight ? 'clear-night' : 'clear-day';
}

/**
 * Determines the appropriate Meteocons icon name based on weather description
 *
 * @param description - NOAA weather description (e.g., "Chance Rain And Snow Showers")
 * @param isNight - Whether it's nighttime (default: false)
 * @returns Meteocons icon name (e.g., "sleet", "partly-cloudy-day-rain")
 */
export function getWeatherIconName(description: string | null | undefined, isNight = false): string {
  if (!description) {
    return isNight ? 'clear-night' : 'clear-day';
  }

  const desc = description.toLowerCase();
  const timePrefix = isNight ? 'night' : 'day';

  // Priority order matters! Check most specific conditions first

  // 1. THUNDERSTORMS (check before rain/snow)
  if (desc.includes('thunderstorm') || desc.includes('t-storm') || desc.includes('tstorm')) {
    if (desc.includes('snow')) {
      return `thunderstorms-${timePrefix}-snow`;
    }
    if (desc.includes('rain') || desc.includes('shower')) {
      return `thunderstorms-${timePrefix}-rain`;
    }
    return `thunderstorms-${timePrefix}`;
  }

  // 2. MIXED PRECIPITATION - Sleet, freezing rain, rain/snow mix
  if (
    desc.includes('sleet') ||
    desc.includes('freezing rain') ||
    desc.includes('ice pellets') ||
    (desc.includes('rain') && desc.includes('snow')) ||
    (desc.includes('rain') && desc.includes('freez')) ||
    desc.includes('wintry mix')
  ) {
    // Check cloud cover for sleet
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-sleet`;
    }
    if (desc.includes('overcast') || desc.includes('mostly cloudy')) {
      return `overcast-${timePrefix}-sleet`;
    }
    if (desc.includes('extreme') || desc.includes('heavy')) {
      return `extreme-${timePrefix}-sleet`;
    }
    return 'sleet';
  }

  // 3. SNOW (check before "showers" to avoid rain icon)
  if (desc.includes('snow') || desc.includes('flurr')) {
    // Check cloud cover - Meteocons only has partly-cloudy variants for snow
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-snow`;
    }
    // For all other conditions (overcast, heavy, blizzard, etc.), use generic snow
    // Note: Meteocons doesn't have overcast-snow or extreme-snow variants
    return 'snow';
  }

  // 4. HAIL
  if (desc.includes('hail')) {
    if (desc.includes('extreme')) {
      return `extreme-${timePrefix}-hail`;
    }
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-hail`;
    }
    if (desc.includes('overcast') || desc.includes('mostly cloudy')) {
      return `overcast-${timePrefix}-hail`;
    }
    return 'hail';
  }

  // 5. RAIN AND SHOWERS (now safe to check "showers")
  if (desc.includes('rain') || desc.includes('shower') || desc.includes('drizzle')) {
    // Drizzle is lighter
    if (desc.includes('drizzle')) {
      if (desc.includes('extreme')) {
        return `extreme-${timePrefix}-drizzle`;
      }
      if (desc.includes('partly') || desc.includes('partial')) {
        return `partly-cloudy-${timePrefix}-drizzle`;
      }
      if (desc.includes('overcast') || desc.includes('mostly cloudy')) {
        return `overcast-${timePrefix}-drizzle`;
      }
      return 'drizzle';
    }

    // Extreme rain
    if (desc.includes('extreme') || desc.includes('heavy rain')) {
      return `extreme-${timePrefix}-rain`;
    }

    // Rain with cloud cover
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-rain`;
    }
    if (desc.includes('overcast') || desc.includes('mostly cloudy')) {
      return `overcast-${timePrefix}-rain`;
    }

    return 'rain';
  }

  // 6. FOG, HAZE, SMOKE
  if (desc.includes('fog') || desc.includes('foggy')) {
    if (desc.includes('extreme')) {
      return `extreme-${timePrefix}-fog`;
    }
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-fog`;
    }
    if (desc.includes('overcast')) {
      return `overcast-${timePrefix}-fog`;
    }
    return `fog-${timePrefix}`;
  }

  if (desc.includes('haze') || desc.includes('hazy')) {
    if (desc.includes('extreme')) {
      return `extreme-${timePrefix}-haze`;
    }
    return `haze-${timePrefix}`;
  }

  if (desc.includes('smoke') || desc.includes('smoky')) {
    if (desc.includes('extreme')) {
      return `extreme-${timePrefix}-smoke`;
    }
    return `smoke-${timePrefix}`;
  }

  if (desc.includes('dust')) {
    return `dust-${timePrefix}`;
  }

  // 7. TORNADO / EXTREME WIND
  if (desc.includes('tornado')) {
    return 'tornado';
  }

  if (desc.includes('hurricane')) {
    return 'hurricane';
  }

  // 8. CLOUD COVER
  if (desc.includes('partly cloudy') || desc.includes('partly sunny') || desc.includes('partial')) {
    return `partly-cloudy-${timePrefix}`;
  }

  if (desc.includes('mostly cloudy') || desc.includes('overcast')) {
    return `overcast-${timePrefix}`;
  }

  if (desc.includes('cloudy')) {
    return 'cloudy';
  }

  // 9. CLEAR CONDITIONS (default)
  if (
    desc.includes('clear') ||
    desc.includes('sunny') ||
    desc.includes('fair') ||
    desc.includes('mostly sunny')
  ) {
    return isNight ? 'clear-night' : 'clear-day';
  }

  // 10. FALLBACK
  // If no match, return based on generic keywords
  if (desc.includes('cloud')) {
    return 'cloudy';
  }

  // Ultimate fallback
  return isNight ? 'clear-night' : 'clear-day';
}

/**
 * Checks if a forecast period name indicates nighttime
 *
 * @param periodName - NOAA period name (e.g., "Tonight", "Monday Night")
 * @returns true if the period is at night
 */
export function isNightPeriod(periodName: string | null | undefined): boolean {
  if (!periodName) return false;
  const name = periodName.toLowerCase();
  return name.includes('night') || name.includes('tonight');
}
