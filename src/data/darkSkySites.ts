/**
 * Curated dark sky viewing sites in Vermont
 * Hand-picked locations with good sky quality, accessibility, and safety
 */

import type { DarkSkySite } from '../types/stargazing';

export const DARK_SKY_SITES: DarkSkySite[] = [
  // Northeast Kingdom - Darkest skies in Vermont
  {
    id: 'victory-state-forest',
    name: 'Victory State Forest',
    coordinates: [-71.8667, 44.5000],
    bortleClass: 2,
    elevation: 450,
    facilities: { parking: true, camping: true, restrooms: false },
    accessibility: 'moderate',
    description: 'One of the darkest locations in Vermont, deep in the Northeast Kingdom wilderness.',
    viewingNotes: 'Remote location with minimal light pollution. Bring insect repellent in summer. Best accessed via Victory Road.',
    bestFor: ['milky-way', 'deep-sky', 'aurora'],
    landType: 'state-forest'
  },
  {
    id: 'willoughby-state-forest',
    name: 'Willoughby State Forest',
    coordinates: [-72.0500, 44.7333],
    bortleClass: 2,
    elevation: 520,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Excellent dark skies near Lake Willoughby with dramatic mountain backdrop.',
    viewingNotes: 'Mount Pisgah and Mount Hor provide natural horizon blocking. Northern exposure good for aurora watching.',
    bestFor: ['milky-way', 'aurora', 'meteor-showers'],
    landType: 'state-forest'
  },
  {
    id: 'brighton-state-park',
    name: 'Brighton State Park',
    coordinates: [-71.9167, 44.7833],
    bortleClass: 2,
    elevation: 410,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Campground on Spectacle Pond with excellent dark skies and lake reflections.',
    viewingNotes: 'Open meadow areas provide unobstructed views. Island Pond light visible on horizon but minimal impact.',
    bestFor: ['milky-way', 'planets', 'meteor-showers'],
    landType: 'state-park'
  },

  // Green Mountain National Forest - Central Vermont
  {
    id: 'moosalamoo-recreation-area',
    name: 'Moosalamoo Recreation Area',
    coordinates: [-73.0833, 43.9167],
    bortleClass: 3,
    sqmReading: 21.3,
    elevation: 580,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Large recreation area in Green Mountain National Forest with multiple viewing spots.',
    viewingNotes: 'Silver Lake area provides open water reflection opportunities. Falls of Lana parking lot has good southern horizon.',
    bestFor: ['milky-way', 'deep-sky', 'planets'],
    landType: 'national-forest'
  },
  {
    id: 'texas-falls',
    name: 'Texas Falls Recreation Area',
    coordinates: [-72.8833, 43.9500],
    bortleClass: 3,
    elevation: 490,
    facilities: { parking: true, camping: false, restrooms: true },
    accessibility: 'easy',
    description: 'Easy-access spot along Route 125 in the Green Mountain National Forest.',
    viewingNotes: 'Parking area provides good views. Limited southern horizon due to trees, but excellent overhead viewing.',
    bestFor: ['planets', 'meteor-showers'],
    landType: 'national-forest'
  },
  {
    id: 'grout-pond',
    name: 'Grout Pond Recreation Area',
    coordinates: [-72.9500, 43.0167],
    bortleClass: 3,
    elevation: 610,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'moderate',
    description: 'Remote pond in southern Green Mountain National Forest with dark skies.',
    viewingNotes: 'Canoe to the pond for incredible reflection shots. Southeastern horizon is darkest.',
    bestFor: ['milky-way', 'deep-sky'],
    landType: 'national-forest'
  },

  // State Forests - Good darkness, variable facilities
  {
    id: 'groton-state-forest',
    name: 'Groton State Forest',
    coordinates: [-72.2667, 44.2833],
    bortleClass: 3,
    elevation: 430,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Large state forest with multiple access points and dark skies.',
    viewingNotes: 'Owl\'s Head trail summit provides 360-degree views. Kettle Pond area also excellent.',
    bestFor: ['milky-way', 'planets', 'aurora'],
    landType: 'state-forest'
  },
  {
    id: 'maidstone-state-park',
    name: 'Maidstone State Park',
    coordinates: [-71.6167, 44.6333],
    bortleClass: 2,
    elevation: 360,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'moderate',
    description: 'Remote state park on Maidstone Lake with some of Vermont\'s darkest skies.',
    viewingNotes: 'Lake provides excellent reflection opportunities. Very dark to the north - prime aurora territory.',
    bestFor: ['milky-way', 'aurora', 'deep-sky'],
    landType: 'state-park'
  },
  {
    id: 'camel-hump-state-park',
    name: 'Camel\'s Hump State Park',
    coordinates: [-72.8667, 44.3167],
    bortleClass: 4,
    elevation: 1244,
    facilities: { parking: true, camping: false, restrooms: false },
    accessibility: 'difficult',
    description: 'High-altitude viewing from Vermont\'s third highest peak. Above tree line.',
    viewingNotes: 'Summit hike required (2+ hours). Best for experienced hikers. Incredible 360-degree views above clouds.',
    bestFor: ['milky-way', 'meteor-showers', 'planets'],
    landType: 'state-park'
  },

  // Mad River Valley
  {
    id: 'lincoln-gap',
    name: 'Lincoln Gap',
    coordinates: [-72.9500, 44.0833],
    bortleClass: 4,
    elevation: 690,
    facilities: { parking: true, camping: false, restrooms: false },
    accessibility: 'easy',
    description: 'Mountain pass with excellent views and reasonable darkness.',
    viewingNotes: 'Small parking area at the gap. Good northern and southern horizons. Road closed in winter.',
    bestFor: ['planets', 'meteor-showers'],
    landType: 'public-land'
  },
  {
    id: 'appalachian-gap',
    name: 'Appalachian Gap',
    coordinates: [-72.9333, 44.2500],
    bortleClass: 4,
    elevation: 730,
    facilities: { parking: true, camping: false, restrooms: false },
    accessibility: 'easy',
    description: 'High mountain pass between Mad River Valley and Champlain Valley.',
    viewingNotes: 'Parking at the gap summit. Light pollution visible from Burlington to the west, but east is dark.',
    bestFor: ['planets', 'meteor-showers'],
    landType: 'public-land'
  },

  // Southern Vermont
  {
    id: 'ball-mountain-dam',
    name: 'Ball Mountain Dam',
    coordinates: [-72.8000, 43.1333],
    bortleClass: 3,
    elevation: 380,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Army Corps of Engineers facility with open areas and dark skies.',
    viewingNotes: 'Dam area provides wide open horizons. Campsites available for extended viewing sessions.',
    bestFor: ['milky-way', 'meteor-showers'],
    landType: 'public-land'
  },
  {
    id: 'hapgood-pond',
    name: 'Hapgood Pond Recreation Area',
    coordinates: [-72.9500, 43.2667],
    bortleClass: 3,
    elevation: 490,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Green Mountain National Forest swimming and camping area with good skies.',
    viewingNotes: 'Beach area provides open southern views. Water reflection opportunities.',
    bestFor: ['planets', 'milky-way'],
    landType: 'national-forest'
  },

  // Mount Mansfield area
  {
    id: 'smugglers-notch',
    name: 'Smugglers\' Notch',
    coordinates: [-72.7833, 44.5500],
    bortleClass: 4,
    elevation: 640,
    facilities: { parking: true, camping: false, restrooms: false },
    accessibility: 'easy',
    description: 'Dramatic mountain notch with good views when resort lights are off.',
    viewingNotes: 'Best in spring/fall when resort is closed. Cliffs provide natural wind shelter. Road closed in winter.',
    bestFor: ['planets', 'meteor-showers'],
    landType: 'state-park'
  },
  {
    id: 'underhill-state-park',
    name: 'Underhill State Park',
    coordinates: [-72.8500, 44.5333],
    bortleClass: 4,
    elevation: 500,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'moderate',
    description: 'Base of Mount Mansfield with good dark skies away from Burlington light dome.',
    viewingNotes: 'Mountain blocks light from the east. CCC Pavilion area has open views to the west.',
    bestFor: ['planets', 'meteor-showers'],
    landType: 'state-park'
  },

  // Lake Champlain region (darker spots)
  {
    id: 'button-bay-state-park',
    name: 'Button Bay State Park',
    coordinates: [-73.3667, 44.1833],
    bortleClass: 5,
    elevation: 35,
    facilities: { parking: true, camping: true, restrooms: true },
    accessibility: 'easy',
    description: 'Lake Champlain park with western views toward Adirondacks.',
    viewingNotes: 'Adirondack Mountains visible across lake. Good for viewing planets and bright objects. Light pollution from Burlington to the north.',
    bestFor: ['planets'],
    landType: 'state-park'
  },

  // Additional remote locations
  {
    id: 'lewis-pond',
    name: 'Lewis Pond Natural Area',
    coordinates: [-71.7333, 44.6167],
    bortleClass: 2,
    elevation: 490,
    facilities: { parking: true, camping: false, restrooms: false },
    accessibility: 'difficult',
    description: 'Very remote pond in the Northeast Kingdom with pristine dark skies.',
    viewingNotes: 'Requires hiking in. Extremely dark with virtually no artificial light. Best for experienced wilderness visitors.',
    bestFor: ['milky-way', 'deep-sky', 'aurora'],
    landType: 'state-forest'
  },
  {
    id: 'granville-gulf',
    name: 'Granville Gulf Reservation',
    coordinates: [-72.8167, 44.0000],
    bortleClass: 3,
    elevation: 370,
    facilities: { parking: true, camping: false, restrooms: false },
    accessibility: 'easy',
    description: 'State natural area with Moss Glen Falls and good mountain-blocked horizons.',
    viewingNotes: 'Pull-offs along Route 100 provide viewing spots. Valley orientation blocks some light pollution.',
    bestFor: ['planets', 'meteor-showers'],
    landType: 'state-forest'
  }
];

// Get sites sorted by darkness (best first)
export function getSitesByDarkness(): DarkSkySite[] {
  return [...DARK_SKY_SITES].sort((a, b) => a.bortleClass - b.bortleClass);
}

// Get sites by accessibility
export function getSitesByAccessibility(level: 'easy' | 'moderate' | 'difficult'): DarkSkySite[] {
  return DARK_SKY_SITES.filter(site => site.accessibility === level);
}

// Get sites with camping
export function getSitesWithCamping(): DarkSkySite[] {
  return DARK_SKY_SITES.filter(site => site.facilities.camping);
}

// Get sites good for specific activity
export function getSitesFor(activity: DarkSkySite['bestFor'][number]): DarkSkySite[] {
  return DARK_SKY_SITES.filter(site => site.bestFor.includes(activity));
}
