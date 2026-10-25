/**
 * MapLibre positions a marker by setting `transform` on the marker element.
 * A transform or transform transition on that element makes markers drift
 * behind the map while panning (VTL-63), so visuals belong on an inner element.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** [path from src/, class of the element MapLibre positions] */
const MARKERS: [file: string, markerClass: string][] = [
  ['utils/mapMarker.css', 'map-marker'],
  ['components/RoadWeatherLayer.css', 'road-weather-marker'],
];

/** [selector, declarations] for each top-level rule (no nesting in these files). */
function rules(css: string): [string, string][] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...noComments.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!]);
}

describe('map marker CSS (VTL-63)', () => {
  for (const [file, cls] of MARKERS) {
    it(`${file}: .${cls} itself gets no transform or transition`, () => {
      const css = readFileSync(join(__dirname, '..', '..', file), 'utf8');
      // Selectors that target the marker element itself (optionally with
      // modifier classes / pseudo-classes), not a descendant of it
      const self = new RegExp(`^\\.${cls}(?:[.:][\\w-]+(?:\\([^)]*\\))?)*$`);
      const offending = rules(css)
        .flatMap(([selectors, body]) => selectors.split(',').map((s) => [s.trim(), body] as const))
        .filter(([s, body]) => self.test(s) && /\b(transform|transition)\s*:/.test(body))
        .map(([s]) => s);
      expect(offending).toEqual([]);
    });
  }
});
