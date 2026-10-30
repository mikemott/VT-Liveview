/**
 * Lake Champlain ferries (VTL-81): the crossings, from OpenStreetMap
 * (route=ferry ways, Oct 2026), with what the operators publish about each.
 *
 * The operators don't offer a machine-readable status (ferries.com blocks
 * automated requests), so status is the published season for the date, and
 * every panel links to the operator for live changes: weather, ice, low water.
 * Re-check the seasons and notes each spring.
 */

export type FerryKind = 'car' | 'passenger' | 'bike';

/** "MM-DD", or a holiday that moves each year (worked out in utils/ferries.ts) */
export type SeasonDate = `${number}-${number}` | 'memorialDayWeekend' | 'laborDay';

/** Published season: which days of the year it runs (inclusive) */
export interface FerrySeason {
  /** Omit both for year-round */
  from?: SeasonDate;
  to?: SeasonDate;
  /** Run on some days after `to` until this date (e.g. autumn weekends) */
  shoulderTo?: SeasonDate;
  /** Months (1-12) when ice often stops it */
  iceMonths?: number[];
}

export interface Ferry {
  id: string;
  name: string;
  /** e.g. "Grand Isle, VT ↔ Plattsburgh, NY" */
  between: string;
  operator: string;
  operatorUrl: string;
  phone?: string;
  kind: FerryKind;
  crossingMinutes: number;
  /** One line about when it runs */
  service: string;
  notes: string[];
  season: FerrySeason;
  /** [lng, lat] from the Vermont landing to the far one */
  route: [number, number][];
}

const LCT = {
  operator: 'Lake Champlain Transportation',
  operatorUrl: 'https://ferries.com/',
  phone: '802-864-9804',
};

export const FERRIES: Ferry[] = [
  {
    id: 'grand-isle',
    name: 'Grand Isle ferry',
    between: 'Grand Isle, VT ↔ Plattsburgh (Cumberland Head), NY',
    ...LCT,
    kind: 'car',
    crossingMinutes: 12,
    service: 'Year-round, 24 hours a day',
    notes: ['The ice-breaking route: it runs through the winter when the others stop.'],
    season: {},
    route: [
      [-73.34961, 44.68805],
      [-73.34996, 44.68849],
      [-73.35041, 44.68883],
      [-73.351, 44.68915],
      [-73.35256, 44.68989],
      [-73.36032, 44.69333],
      [-73.3668, 44.69635],
      [-73.37408, 44.69982],
      [-73.37543, 44.70031],
      [-73.37672, 44.70057],
      [-73.37791, 44.70057],
      [-73.37877, 44.70028],
      [-73.37955, 44.69971],
      [-73.38034, 44.69903],
    ],
  },
  {
    id: 'charlotte',
    name: 'Charlotte ferry',
    between: 'Charlotte, VT ↔ Essex, NY',
    ...LCT,
    kind: 'car',
    crossingMinutes: 25,
    service: 'Year-round; winter schedule from November 2, 2026',
    notes: ['Ice often closes this crossing for days or weeks in mid-winter.', 'No reservations.'],
    season: { iceMonths: [1, 2, 3] },
    route: [
      [-73.29716, 44.30138],
      [-73.29751, 44.30113],
      [-73.29791, 44.30086],
      [-73.29837, 44.30063],
      [-73.29889, 44.30046],
      [-73.29996, 44.30026],
      [-73.30194, 44.30018],
      [-73.30318, 44.3002],
      [-73.3055, 44.30052],
      [-73.31039, 44.30159],
      [-73.31842, 44.30374],
      [-73.33121, 44.30801],
      [-73.337, 44.3097],
      [-73.34099, 44.31053],
      [-73.34378, 44.31087],
      [-73.34569, 44.31099],
      [-73.34777, 44.31099],
      [-73.34938, 44.31091],
      [-73.35077, 44.3108],
      [-73.35088, 44.31079],
    ],
  },
  {
    id: 'fort-ticonderoga',
    name: 'Fort Ticonderoga ferry',
    between: 'Shoreham (Larrabees Point), VT ↔ Ticonderoga, NY',
    operator: 'Fort Ti Ferry',
    operatorUrl: 'https://forttiferry.com/',
    kind: 'car',
    crossingMinutes: 7,
    service: 'Seasonal, about May to October; 7 AM to 6 PM in 2026',
    notes: [
      'A cable ferry, running since 1759.',
      'Cash only; arrive about 15 minutes early.',
      'It closed early in September 2025 when the lake was too low.',
    ],
    season: { from: '05-01', to: '10-15', shoulderTo: '10-31' },
    route: [
      [-73.37652, 43.85531],
      [-73.38519, 43.85406],
    ],
  },
  {
    id: 'bike-ferry',
    name: 'Island Line bike ferry',
    between: 'Colchester Causeway ↔ South Hero, across "the Cut"',
    operator: 'Local Motion',
    operatorUrl: 'https://www.localmotion.org/bike_ferry',
    kind: 'bike',
    crossingMinutes: 5,
    service:
      'Daily from Memorial Day weekend to Labor Day, about 10 AM to 6 PM; some autumn weekends',
    notes: [
      'Bikes and people on foot only. It links the Island Line Trail to the Champlain Islands.',
      'High wind or thunderstorms pause it; waits can be long on summer weekends.',
    ],
    season: { from: 'memorialDayWeekend', to: 'laborDay', shoulderTo: '10-15' },
    route: [
      [-73.31187, 44.59232],
      [-73.31145, 44.59225],
      [-73.31136, 44.59222],
      [-73.31127, 44.59216],
      [-73.31121, 44.5921],
      [-73.31117, 44.59205],
      [-73.31114, 44.59197],
      [-73.31112, 44.59191],
      [-73.31112, 44.59185],
      [-73.31113, 44.59178],
      [-73.31161, 44.59051],
      [-73.31165, 44.59044],
      [-73.31172, 44.59038],
      [-73.31182, 44.59035],
      [-73.31193, 44.59032],
      [-73.31201, 44.59031],
      [-73.31211, 44.5903],
      [-73.31226, 44.59032],
      [-73.31252, 44.59035],
    ],
  },
  {
    id: 'island-runner',
    name: 'Island Runner',
    between: 'Kill Kare State Park ↔ Burton Island State Park',
    operator: 'Vermont State Parks',
    operatorUrl: 'https://www.vtstateparks.com/parks/burton-island',
    phone: '802-524-6021',
    kind: 'passenger',
    crossingMinutes: 10,
    service: 'Memorial Day weekend to Labor Day; trips by reservation (call Kill Kare)',
    notes: [
      'Passengers and their gear only; Burton Island is car-free.',
      'Back in service in August 2026 after more than a year out.',
    ],
    season: { from: 'memorialDayWeekend', to: 'laborDay' },
    route: [
      [-73.18166, 44.7783],
      [-73.18095, 44.77828],
      [-73.18052, 44.77801],
      [-73.18055, 44.77757],
      [-73.18166, 44.77691],
      [-73.18838, 44.77632],
      [-73.19739, 44.77672],
    ],
  },
];
