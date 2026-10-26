/**
 * EPA Air Quality Index categories (VTL-75): names, official colors and a
 * readable text color for each, plus short guidance.
 * https://www.airnow.gov/aqi/aqi-basics/
 */
import type { Pollutant } from '../services/airQualityApi';

export interface AqiCategory {
  name: string;
  /** Official EPA color */
  color: string;
  /** Text color with >= 4.5:1 on `color` */
  text: string;
  /** One-line guidance */
  advice: string;
}

export const AQI_CATEGORIES: Record<number, AqiCategory> = {
  1: { name: 'Good', color: '#00e400', text: '#000000', advice: 'Air quality is good.' },
  2: {
    name: 'Moderate',
    color: '#ffff00',
    text: '#000000',
    advice: 'Unusually sensitive people should consider limiting long outdoor exertion.',
  },
  3: {
    name: 'Unhealthy for Sensitive Groups',
    color: '#ff7e00',
    text: '#000000',
    advice:
      'People with heart or lung disease, older adults and children should limit long outdoor exertion.',
  },
  4: {
    name: 'Unhealthy',
    color: '#ff0000',
    text: '#000000',
    advice: 'Everyone should limit long outdoor exertion; sensitive groups should avoid it.',
  },
  5: {
    name: 'Very Unhealthy',
    color: '#8f3f97',
    text: '#ffffff',
    advice: 'Everyone should avoid long outdoor exertion.',
  },
  6: {
    name: 'Hazardous',
    color: '#7e0023',
    text: '#ffffff',
    advice: 'Everyone should avoid all outdoor exertion.',
  },
};

export function aqiCategory(category: number): AqiCategory {
  return AQI_CATEGORIES[category] ?? AQI_CATEGORIES[1]!;
}

/** Short label for chips: "Sensitive groups" instead of the full name */
export function aqiShortName(category: number): string {
  return category === 3 ? 'Unhealthy for sensitive groups' : aqiCategory(category).name;
}

export function pollutantLabel(p: Pollutant): string {
  return p === 'OZONE' ? 'Ozone' : p === 'PM2.5' ? 'Fine particles (PM2.5)' : 'Particles (PM10)';
}
