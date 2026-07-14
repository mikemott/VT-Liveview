export interface Beach {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  parkType: string;
  amenities: string[];

  // Water quality data (from scraping Burlington API)
  waterQualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  waterTemp: number | null; // Fahrenheit
  eColiLevel: number | null; // per 100 mL
  cyanobacteriaCategory: number | null; // 1=Open, 2=Alert, 3=Closed
  lastTested: string | null; // ISO date
  advisory: string | null; // "Cyanobacteria is present in low levels", etc.
  status: 'open' | 'alert' | 'closed' | 'unknown';
  color: 'green' | 'yellow' | 'red';
  lastUpdated: string; // ISO date
}

export interface BeachCache {
  beaches: Beach[];
  fetchedAt: string;
}

export interface BurlingtonBeachData {
  attributes: {
    OBJECTID: number;
    LocationId: number;
    ResultId: number;
    LocationName: string;
    DisplayOrder: number;
    ResultDateTime: string;
    CreatedBy: string;
    CyanobacteriaCategory: number | null;
    CyanobacteriaDescription: string;
    EColi: number | null;
    Notes: string | null;
    StatusReason: string;
  };
  geometry: {
    x: number;
    y: number;
  };
}

export interface BurlingtonApiResponse {
  features: BurlingtonBeachData[];
}
