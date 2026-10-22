/**
 * Shared helpers for the Vermont ANR ArcGIS fixtures used by the recreation,
 * backcountry, park-boundary and camping-area tests.
 */
import { loadJson } from '../../__fixtures__/load.js';

export const ANR_TOURISM =
  'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer';
export const RECREATION_URL = `${ANR_TOURISM}/166/query`;
export const BACKCOUNTRY_URL = `${ANR_TOURISM}/175/query`;
export const PARK_BOUNDARIES_URL =
  'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_CADASTRAL_SP_NOCACHE_v2/MapServer/38/query';

export interface EsriFeature {
  attributes: Record<string, unknown> & { OBJECTID: number };
  geometry: { x: number; y: number };
}

export interface EsriResponse {
  features: EsriFeature[];
  exceededTransferLimit?: boolean;
}

/**
 * Load an ArcGIS fixture and pad it to at least `minFeatures` by cloning the
 * first (valid) feature with fresh OBJECTIDs. The services reject responses
 * below a minimum site count, but the fixtures are kept deliberately small.
 */
export function paddedFixture(path: string, minFeatures: number): EsriResponse {
  const data = loadJson<EsriResponse>(path);
  const template = data.features[0]!;
  for (let i = data.features.length; i < minFeatures; i++) {
    data.features.push({
      attributes: { ...template.attributes, OBJECTID: 10_000 + i },
      geometry: { ...template.geometry },
    });
  }
  return data;
}
