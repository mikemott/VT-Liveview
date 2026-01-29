/**
 * Stargazing feature types
 * Types for light pollution, dark sky sites, and astronomy events
 */

export type BortleClass = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface StargazingConditions {
  cloudCoverPercent: number;
  moonPhase: number;        // 0-1 (0=new, 0.5=full, 1=new again)
  moonIllumination: number; // 0-100%
  moonPhaseName: string;
  moonRiseTime: string | null;
  moonSetTime: string | null;
  astronomicalTwilight: string;
  sunsetTime: string;
  qualityScore: number;     // 0-100
  qualityRating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  bestViewingWindow: { start: string; end: string } | null;
}

export interface DarkSkySite {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  bortleClass: BortleClass;
  sqmReading?: number;      // Sky Quality Meter (magnitude/sq arcsec)
  elevation?: number;       // meters
  facilities: {
    parking: boolean;
    camping: boolean;
    restrooms: boolean;
  };
  accessibility: 'easy' | 'moderate' | 'difficult';
  description: string;
  viewingNotes: string;
  bestFor: ('milky-way' | 'deep-sky' | 'planets' | 'aurora' | 'meteor-showers')[];
  landType: 'state-forest' | 'national-forest' | 'state-park' | 'town-forest' | 'public-land';
}

export interface MeteorShower {
  id: string;
  name: string;
  peakMonth: number;        // 1-12
  peakDay: number;          // 1-31
  activeStartMonth: number;
  activeStartDay: number;
  activeEndMonth: number;
  activeEndDay: number;
  zenithalHourlyRate: number;
  radiantConstellation: string;
  parentBody?: string;
  description: string;
  viewingTips: string;
}

export interface LightPollutionZone {
  bortleClass: BortleClass;
  description: string;
  canSee: string[];
}

export interface PlanetVisibility {
  name: string;
  isVisible: boolean;
  riseTime: string | null;
  setTime: string | null;
  magnitude: number;
  constellation: string;
  description: string;
}

export interface AstronomyEvent {
  id: string;
  name: string;
  date: Date;
  type: 'meteor-shower' | 'lunar-eclipse' | 'solar-eclipse' | 'conjunction' | 'planet-visibility';
  description: string;
  viewingTips: string;
}

// Bortle scale descriptions and what you can see at each level
export const BORTLE_DESCRIPTIONS: Record<BortleClass, LightPollutionZone> = {
  1: {
    bortleClass: 1,
    description: 'Excellent dark sky site',
    canSee: ['Zodiacal light', 'Gegenschein', 'Zodiacal band', 'M33 visible with naked eye', 'Milky Way casts shadows']
  },
  2: {
    bortleClass: 2,
    description: 'Typical truly dark site',
    canSee: ['Zodiacal light clearly visible', 'M33 visible', 'Milky Way highly structured', 'Summer Milky Way spectacular']
  },
  3: {
    bortleClass: 3,
    description: 'Rural sky',
    canSee: ['Zodiacal light visible in spring/autumn', 'Milky Way well structured', 'M31 easily visible', 'Some light pollution on horizon']
  },
  4: {
    bortleClass: 4,
    description: 'Rural/suburban transition',
    canSee: ['Zodiacal light barely visible', 'Milky Way visible but lacks detail', 'M31 visible', 'Light domes visible on horizon']
  },
  5: {
    bortleClass: 5,
    description: 'Suburban sky',
    canSee: ['Milky Way washed out', 'Only brightest stars visible in constellations', 'M31 barely visible', 'Light domes prominent']
  },
  6: {
    bortleClass: 6,
    description: 'Bright suburban sky',
    canSee: ['Milky Way only visible at zenith', 'Stars to magnitude 5.5', 'Planets easily visible', 'Heavy light pollution']
  },
  7: {
    bortleClass: 7,
    description: 'Suburban/urban transition',
    canSee: ['Milky Way invisible', 'Stars to magnitude 5', 'Only bright constellations recognizable']
  },
  8: {
    bortleClass: 8,
    description: 'City sky',
    canSee: ['Stars to magnitude 4.5', 'Only brightest stars visible', 'Moon and planets easily seen']
  },
  9: {
    bortleClass: 9,
    description: 'Inner-city sky',
    canSee: ['Stars to magnitude 4', 'Only a few stars visible', 'Entire sky has a glow']
  }
};

// Color scheme for Bortle zones on the map
export const BORTLE_COLORS: Record<BortleClass, string> = {
  1: '#000022', // Deep blue-black (excellent)
  2: '#000033', // Dark blue
  3: '#001a4d', // Very good
  4: '#003366', // Good
  5: '#336699', // Suburban
  6: '#6699cc', // Bright suburban
  7: '#99ccff', // Suburban/urban
  8: '#ffcc99', // City
  9: '#ffff99', // Inner city (bright yellow)
};
