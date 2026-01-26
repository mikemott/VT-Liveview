export interface SkiResort {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  snowfall24hr: number | null;
  snowfallCumulative: number | null;
  liftsOpen: number;
  liftsTotal: number;
  trailsOpen: number;
  trailsTotal: number;
  tempCurrent: number | null;
  tempHigh: number | null;
  tempLow: number | null;
  baseDepth: number | null;
  lastUpdated: string;
  status: 'open' | 'partial' | 'closed';
  color: 'green' | 'yellow' | 'red';
}

export interface ResortCoordinates {
  lat: number;
  lon: number;
}

export interface SkiConditionsCache {
  resorts: SkiResort[];
  fetchedAt: string;
}
