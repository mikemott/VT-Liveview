/**
 * Meteor Shower Calendar
 * Annual meteor shower data for Vermont stargazing
 */

import type { MeteorShower } from '../types/stargazing';

export const METEOR_SHOWERS: MeteorShower[] = [
  {
    id: 'quadrantids',
    name: 'Quadrantids',
    peakMonth: 1,
    peakDay: 4,
    activeStartMonth: 1,
    activeStartDay: 1,
    activeEndMonth: 1,
    activeEndDay: 10,
    zenithalHourlyRate: 120,
    radiantConstellation: 'Boötes',
    parentBody: 'Asteroid 2003 EH1',
    description: 'One of the strongest annual showers with a sharp peak lasting only a few hours.',
    viewingTips: 'Best after midnight. Radiant is high in the northeast. Dress warmly - January in Vermont!'
  },
  {
    id: 'lyrids',
    name: 'Lyrids',
    peakMonth: 4,
    peakDay: 22,
    activeStartMonth: 4,
    activeStartDay: 16,
    activeEndMonth: 4,
    activeEndDay: 25,
    zenithalHourlyRate: 18,
    radiantConstellation: 'Lyra',
    parentBody: 'Comet C/1861 G1 Thatcher',
    description: 'One of the oldest known meteor showers, observed for 2,700 years.',
    viewingTips: 'Best after midnight when Lyra is high. Look for bright fireballs with persistent trains.'
  },
  {
    id: 'eta-aquariids',
    name: 'Eta Aquariids',
    peakMonth: 5,
    peakDay: 6,
    activeStartMonth: 4,
    activeStartDay: 19,
    activeEndMonth: 5,
    activeEndDay: 28,
    zenithalHourlyRate: 50,
    radiantConstellation: 'Aquarius',
    parentBody: 'Comet 1P/Halley',
    description: 'Debris from Halley\'s Comet. Better viewing in southern latitudes, but still visible from Vermont.',
    viewingTips: 'Best in pre-dawn hours. Radiant is low in the east, so look for long "earthgrazer" meteors.'
  },
  {
    id: 'delta-aquariids',
    name: 'Delta Aquariids',
    peakMonth: 7,
    peakDay: 30,
    activeStartMonth: 7,
    activeStartDay: 12,
    activeEndMonth: 8,
    activeEndDay: 23,
    zenithalHourlyRate: 20,
    radiantConstellation: 'Aquarius',
    description: 'A warm-weather shower that overlaps with the early Perseids.',
    viewingTips: 'Best after midnight. Faint meteors - find the darkest site possible.'
  },
  {
    id: 'perseids',
    name: 'Perseids',
    peakMonth: 8,
    peakDay: 12,
    activeStartMonth: 7,
    activeStartDay: 17,
    activeEndMonth: 8,
    activeEndDay: 24,
    zenithalHourlyRate: 100,
    radiantConstellation: 'Perseus',
    parentBody: 'Comet 109P/Swift-Tuttle',
    description: 'The most popular meteor shower - warm summer nights and high rates make it a crowd favorite.',
    viewingTips: 'Best after midnight. Perseus rises in the northeast. Bring a blanket and enjoy the warm August night!'
  },
  {
    id: 'orionids',
    name: 'Orionids',
    peakMonth: 10,
    peakDay: 21,
    activeStartMonth: 10,
    activeStartDay: 2,
    activeEndMonth: 11,
    activeEndDay: 7,
    zenithalHourlyRate: 20,
    radiantConstellation: 'Orion',
    parentBody: 'Comet 1P/Halley',
    description: 'Another shower from Halley\'s Comet. Fast meteors known for bright fireballs.',
    viewingTips: 'Best after midnight when Orion is high. Look for fast meteors with persistent trains.'
  },
  {
    id: 'leonids',
    name: 'Leonids',
    peakMonth: 11,
    peakDay: 17,
    activeStartMonth: 11,
    activeStartDay: 6,
    activeEndMonth: 11,
    activeEndDay: 30,
    zenithalHourlyRate: 15,
    radiantConstellation: 'Leo',
    parentBody: 'Comet 55P/Tempel-Tuttle',
    description: 'Famous for occasional meteor storms. The 1833 storm sparked modern meteor science.',
    viewingTips: 'Best after midnight. Bundle up - November nights are cold! Watch for bright fireballs.'
  },
  {
    id: 'geminids',
    name: 'Geminids',
    peakMonth: 12,
    peakDay: 14,
    activeStartMonth: 12,
    activeStartDay: 4,
    activeEndMonth: 12,
    activeEndDay: 17,
    zenithalHourlyRate: 150,
    radiantConstellation: 'Gemini',
    parentBody: 'Asteroid 3200 Phaethon',
    description: 'The strongest annual shower with multi-colored meteors. Often exceeds 100 meteors/hour.',
    viewingTips: 'Best around 2am when Gemini is highest. Dress very warmly - December in Vermont is brutal!'
  },
  {
    id: 'ursids',
    name: 'Ursids',
    peakMonth: 12,
    peakDay: 22,
    activeStartMonth: 12,
    activeStartDay: 17,
    activeEndMonth: 12,
    activeEndDay: 26,
    zenithalHourlyRate: 10,
    radiantConstellation: 'Ursa Minor',
    parentBody: 'Comet 8P/Tuttle',
    description: 'A modest shower that peaks near the winter solstice - the longest night of the year.',
    viewingTips: 'Radiant is near Polaris, so it\'s visible all night. Low rates but long viewing window.'
  }
];

/**
 * Get meteor showers that are currently active or upcoming within N days
 */
export function getUpcomingShowers(withinDays: number = 60): Array<MeteorShower & {
  daysUntilPeak: number;
  isActive: boolean;
  isPeak: boolean;
}> {
  const now = new Date();
  const currentYear = now.getFullYear();

  return METEOR_SHOWERS.map(shower => {
    // Calculate this year's peak date
    let peakDate = new Date(currentYear, shower.peakMonth - 1, shower.peakDay);

    // If peak has passed, check next year
    if (peakDate < now) {
      peakDate = new Date(currentYear + 1, shower.peakMonth - 1, shower.peakDay);
    }

    const daysUntilPeak = Math.ceil((peakDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if currently active
    const activeStart = new Date(currentYear, shower.activeStartMonth - 1, shower.activeStartDay);
    const activeEnd = new Date(currentYear, shower.activeEndMonth - 1, shower.activeEndDay);

    // Handle year wraparound for showers spanning December-January
    let isActive = now >= activeStart && now <= activeEnd;
    if (shower.activeStartMonth > shower.activeEndMonth) {
      // Shower spans new year
      isActive = now >= activeStart || now <= activeEnd;
    }

    // Check if today is peak day (within 1 day)
    const isPeak = Math.abs(daysUntilPeak) <= 1 ||
      (daysUntilPeak > 364 && daysUntilPeak < 366); // Handle year boundary

    return {
      ...shower,
      daysUntilPeak,
      isActive,
      isPeak
    };
  })
  .filter(shower => shower.daysUntilPeak <= withinDays || shower.isActive)
  .sort((a, b) => a.daysUntilPeak - b.daysUntilPeak);
}

/**
 * Get the next meteor shower peak
 */
export function getNextShowerPeak(): MeteorShower & { daysUntilPeak: number } | null {
  const upcoming = getUpcomingShowers(365);
  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * Check if there's an active meteor shower tonight
 */
export function getActiveShowerTonight(): MeteorShower | null {
  const upcoming = getUpcomingShowers(30);
  const active = upcoming.find(s => s.isActive);
  return active ? METEOR_SHOWERS.find(s => s.id === active.id) ?? null : null;
}
