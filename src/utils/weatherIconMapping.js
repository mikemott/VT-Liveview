/**
 * Weather Icon Mapping Utility
 *
 * Maps NOAA weather descriptions to Meteocons icon names.
 * Handles complex conditions like mixed precipitation, thunderstorms, and time-of-day variations.
 *
 * Priority order ensures accurate icon selection:
 * 1. Thunderstorms (with rain/snow variations)
 * 2. Mixed precipitation (sleet, freezing rain)
 * 3. Snow (catches "Snow Showers" before generic "showers")
 * 4. Hail
 * 5. Rain and showers
 * 6. Fog, haze, smoke, dust
 * 7. Tornadoes and hurricanes
 * 8. Cloud cover variations
 * 9. Clear conditions
 */

/**
 * Determines the appropriate Meteocons icon name based on weather description
 *
 * Uses priority-based matching to handle complex NOAA descriptions like
 * "Chance Rain And Snow Showers" or "Heavy Thunderstorms with Snow".
 *
 * Note: Meteocons 2.0.0 does not include "extreme-" prefixed icons.
 * Heavy/extreme conditions fall back to "overcast-" variants.
 *
 * @param {string} description - NOAA weather description (e.g., "Chance Rain And Snow Showers")
 * @param {boolean} isNight - Whether it's nighttime based on actual time (not UI theme)
 * @returns {string} Meteocons icon name (e.g., "sleet", "partly-cloudy-day-rain", "overcast-night-snow")
 *
 * @example
 * getWeatherIconName("Snow Showers", false) // Returns "snow"
 * getWeatherIconName("Rain And Snow", true) // Returns "sleet"
 * getWeatherIconName("Partly Cloudy", false) // Returns "partly-cloudy-day"
 */
export function getWeatherIconName(description, isNight = false) {
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
    // No extreme variant in Meteocons, use overcast for heavy conditions
    if (desc.includes('extreme') || desc.includes('heavy')) {
      return `overcast-${timePrefix}-sleet`;
    }
    return 'sleet';
  }

  // 3. SNOW (check before "showers" to avoid rain icon)
  if (desc.includes('snow') || desc.includes('flurr')) {
    // Check cloud cover (no extreme variant in Meteocons)
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-snow`;
    }
    if (desc.includes('overcast') || desc.includes('mostly cloudy') || desc.includes('blizzard') || desc.includes('heavy')) {
      return `overcast-${timePrefix}-snow`;
    }
    return 'snow';
  }

  // 4. HAIL
  if (desc.includes('hail')) {
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-hail`;
    }
    // Use overcast for heavy/extreme hail (no extreme variant in Meteocons)
    if (desc.includes('overcast') || desc.includes('mostly cloudy') || desc.includes('extreme') || desc.includes('heavy')) {
      return `overcast-${timePrefix}-hail`;
    }
    return 'hail';
  }

  // 5. RAIN AND SHOWERS (now safe to check "showers")
  if (desc.includes('rain') || desc.includes('shower') || desc.includes('drizzle')) {
    // Drizzle is lighter
    if (desc.includes('drizzle')) {
      if (desc.includes('partly') || desc.includes('partial')) {
        return `partly-cloudy-${timePrefix}-drizzle`;
      }
      // Use overcast for heavy drizzle (no extreme variant in Meteocons)
      if (desc.includes('overcast') || desc.includes('mostly cloudy') || desc.includes('heavy')) {
        return `overcast-${timePrefix}-drizzle`;
      }
      return 'drizzle';
    }

    // Rain with cloud cover (use overcast for heavy rain)
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-rain`;
    }
    if (desc.includes('overcast') || desc.includes('mostly cloudy') || desc.includes('heavy')) {
      return `overcast-${timePrefix}-rain`;
    }

    return 'rain';
  }

  // 6. FOG, HAZE, SMOKE
  if (desc.includes('fog') || desc.includes('foggy')) {
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-fog`;
    }
    if (desc.includes('overcast')) {
      return `overcast-${timePrefix}-fog`;
    }
    return `fog-${timePrefix}`;
  }

  if (desc.includes('haze') || desc.includes('hazy')) {
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-haze`;
    }
    if (desc.includes('overcast')) {
      return `overcast-${timePrefix}-haze`;
    }
    return `haze-${timePrefix}`;
  }

  if (desc.includes('smoke') || desc.includes('smoky')) {
    if (desc.includes('partly') || desc.includes('partial')) {
      return `partly-cloudy-${timePrefix}-smoke`;
    }
    // Meteocons has 'smoke' and 'smoke-particles' but no day/night/overcast variants
    // Use smoke-particles for a more detailed icon
    return 'smoke-particles';
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
 * NOAA forecast periods use naming conventions like "Tonight", "Monday Night",
 * "This Afternoon", etc. This function detects nighttime periods by checking
 * for "night" or "tonight" keywords in the period name.
 *
 * @param {string} periodName - NOAA period name (e.g., "Tonight", "Monday Night", "This Afternoon")
 * @returns {boolean} True if the period represents nighttime, false otherwise
 *
 * @example
 * isNightPeriod("Tonight") // Returns true
 * isNightPeriod("Monday Night") // Returns true
 * isNightPeriod("This Afternoon") // Returns false
 * isNightPeriod("Saturday") // Returns false
 */
export function isNightPeriod(periodName) {
  if (!periodName) return false;
  const name = periodName.toLowerCase();
  return name.includes('night') || name.includes('tonight');
}
