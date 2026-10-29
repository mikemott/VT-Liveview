import { describe, expect, it } from 'vitest';
import type { AlertFeature } from '../../types';
import { alertBounds, isShadedByDefault, severityColor, sortAlerts } from '../alerts';

const alert = (event: string, severity?: string): AlertFeature => ({
  type: 'Feature',
  properties: {
    id: event,
    event,
    headline: '',
    areaDesc: 'Vermont',
    ...(severity && { severity }),
  },
  geometry: null,
});

describe('weather alerts (VTL-85)', () => {
  it('shades only warnings (Severe/Extreme) without a click', () => {
    expect(isShadedByDefault(alert('Tornado Warning', 'Extreme'))).toBe(true);
    expect(isShadedByDefault(alert('Severe Thunderstorm Warning', 'Severe'))).toBe(true);
    expect(isShadedByDefault(alert('Winter Weather Advisory', 'Moderate'))).toBe(false);
    expect(isShadedByDefault(alert('Special Weather Statement', 'Minor'))).toBe(false);
    expect(isShadedByDefault(alert('Test Message'))).toBe(false);
  });

  it('puts the most severe first, keeping NWS order otherwise', () => {
    const sorted = sortAlerts([
      alert('Statement', 'Minor'),
      alert('Advisory A', 'Moderate'),
      alert('Warning', 'Severe'),
      alert('Advisory B', 'Moderate'),
      alert('Unknown'),
    ]);
    expect(sorted.map((a) => a.properties.event)).toEqual([
      'Warning',
      'Advisory A',
      'Advisory B',
      'Statement',
      'Unknown',
    ]);
  });

  it('colours by severity, grey when unknown', () => {
    expect(severityColor('Extreme')).toBe('#d00000');
    expect(severityColor('Unknown')).toBe('#8b8b8b');
    expect(severityColor(undefined)).toBe('#8b8b8b');
  });

  it('bounds Polygon and MultiPolygon areas', () => {
    expect(alertBounds(null)).toBeNull();
    expect(
      alertBounds({
        type: 'Polygon',
        coordinates: [
          [
            [-73, 44],
            [-72, 44.5],
            [-72.5, 45],
          ],
        ],
      }),
    ).toEqual([
      [-73, 44],
      [-72, 45],
    ]);
    expect(
      alertBounds({
        type: 'MultiPolygon',
        coordinates: [[[[-73, 44]]], [[[-71.5, 42.7]]]],
      }),
    ).toEqual([
      [-73, 42.7],
      [-71.5, 44],
    ]);
  });
});
