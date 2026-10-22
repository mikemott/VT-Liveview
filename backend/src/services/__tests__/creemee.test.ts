import { describe, expect, it } from 'vitest';
import {
  fetchCreemeeStands,
  fetchFeaturedStands,
  getCreemeeStandById,
  getCreemeeStandsByTown,
} from '../creemee.js';

describe('creemee service (static data)', () => {
  it('returns every stand with the required fields', async () => {
    const stands = await fetchCreemeeStands();

    expect(stands.length).toBeGreaterThan(0);
    for (const s of stands) {
      expect(s.id).toEqual(expect.any(String));
      expect(s.name).toEqual(expect.any(String));
      expect(s.town).toEqual(expect.any(String));
      expect(typeof s.featured).toBe('boolean');
      // Vermont-ish bounding box
      expect(s.latitude).toBeGreaterThan(42.5);
      expect(s.latitude).toBeLessThan(45.1);
      expect(s.longitude).toBeGreaterThan(-73.5);
      expect(s.longitude).toBeLessThan(-71.4);
    }
  });

  it('has unique ids', async () => {
    const stands = await fetchCreemeeStands();
    expect(new Set(stands.map((s) => s.id)).size).toBe(stands.length);
  });

  it('returns only featured stands', async () => {
    const all = await fetchCreemeeStands();
    const featured = await fetchFeaturedStands();

    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((s) => s.featured)).toBe(true);
    expect(featured).toHaveLength(all.filter((s) => s.featured).length);
  });

  it('finds a stand by id, or null', async () => {
    const [first] = await fetchCreemeeStands();
    expect(await getCreemeeStandById(first!.id)).toEqual(first);
    expect(await getCreemeeStandById('does-not-exist')).toBeNull();
  });

  it('matches town case-insensitively', async () => {
    const [first] = await fetchCreemeeStands();
    const town = first!.town;

    const upper = await getCreemeeStandsByTown(town.toUpperCase());
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.every((s) => s.town.toLowerCase() === town.toLowerCase())).toBe(true);
    expect(await getCreemeeStandsByTown('Nowhereville')).toEqual([]);
  });
});
