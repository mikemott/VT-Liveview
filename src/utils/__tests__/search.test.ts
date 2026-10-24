import { describe, expect, it } from 'vitest';
import { normalize, searchPlaces, type SearchItem } from '../search';
import { VT_COUNTIES, VT_TOWNS } from '../../data/vtTowns';

const towns: SearchItem[] = VT_TOWNS.map(([name, county, lat, lng, w, s, e, n]) => ({
  id: `town:${name}`,
  kind: 'town',
  name,
  detail: `${VT_COUNTIES[county]} County`,
  lat,
  lng,
  bounds: [w, s, e, n],
}));

const names = (results: SearchItem[]) => results.map((r) => r.name);

describe('VT_TOWNS data', () => {
  it('has all 256 towns, cities and gores, inside Vermont', () => {
    expect(VT_TOWNS).toHaveLength(256);
    for (const [name, county, lat, lng, w, s, e, n] of VT_TOWNS) {
      expect(VT_COUNTIES[county], name).toBeDefined();
      expect(lat).toBeGreaterThan(42.7);
      expect(lat).toBeLessThan(45.02);
      expect(lng).toBeGreaterThan(-73.44);
      expect(lng).toBeLessThan(-71.46);
      // label point inside its own bounding box
      expect(lng >= w && lng <= e && lat >= s && lat <= n, name).toBe(true);
    }
  });
});

describe('normalize', () => {
  it('folds case, accents, punctuation and St./Mt.', () => {
    expect(normalize('St. Johnsbury')).toBe('saint johnsbury');
    expect(normalize('Mt Holly')).toBe('mount holly');
    expect(normalize("Avery's Gore")).toBe('averys gore');
    expect(normalize('  Café  ')).toBe('cafe');
  });
});

describe('searchPlaces', () => {
  it('ranks exact and prefix matches first', () => {
    expect(names(searchPlaces(towns, 'burlington')).slice(0, 2)).toEqual([
      'Burlington',
      'South Burlington',
    ]);
    expect(names(searchPlaces(towns, 'mont'))[0]).toBe('Montgomery');
  });

  it('understands St. and Mt. abbreviations', () => {
    expect(names(searchPlaces(towns, 'st albans'))).toEqual(
      expect.arrayContaining(['Saint Albans City', 'Saint Albans Town']),
    );
    expect(names(searchPlaces(towns, 'mt holly'))[0]).toBe('Mount Holly');
  });

  it('matches multiple word prefixes in any order', () => {
    expect(names(searchPlaces(towns, 'burl so'))[0]).toBe('South Burlington');
  });

  it('matches the county with lower weight than the name', () => {
    const results = searchPlaces(towns, 'lamoille', 20);
    expect(results.length).toBeGreaterThan(5);
    expect(results.every((r) => r.detail === 'Lamoille County')).toBe(true);
  });

  it('matches hidden keywords such as an incident road', () => {
    const incident: SearchItem = {
      id: 'incident:1',
      kind: 'incident',
      name: 'Road closed',
      keywords: 'VT-108',
      lat: 44.53,
      lng: -72.78,
    };
    expect(searchPlaces([incident, ...towns], 'vt 108')).toEqual([incident]);
  });

  it('puts towns before other kinds on equal scores, and respects the limit', () => {
    const ski: SearchItem = { id: 'ski:stowe', kind: 'ski', name: 'Stowe', lat: 44.5, lng: -72.8 };
    expect(searchPlaces([ski, ...towns], 'stowe').map((r) => r.kind)).toEqual(['town', 'ski']);
    expect(searchPlaces(towns, 'a', 5)).toEqual([]); // too short
    expect(searchPlaces(towns, 'ar', 5)).toHaveLength(5);
  });
});
