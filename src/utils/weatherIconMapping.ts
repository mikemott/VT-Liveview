/**
 * Weather Icon Mapping Utility
 *
 * Maps NOAA weather descriptions to Meteocons icon names.
 * Handles complex conditions like mixed precipitation, thunderstorms, and time-of-day variations.
 */

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
    // Check for blizzard/extreme
    if (desc.includes('blizzard') || desc.includes('extreme') || desc.includes('heavy snow')) {
      return `extreme-${timePrefix}-snow`;
    }
    // Check cloud cover
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-snow`;
    }
    if (desc.includes('overcast') || desc.includes('mostly cloudy')) {
      return `overcast-${timePrefix}-snow`;
    }
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
