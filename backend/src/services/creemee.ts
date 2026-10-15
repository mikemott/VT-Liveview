/**
 * Creemee Stands Service
 *
 * Provides access to curated Vermont creemee stand data.
 * Data is static (loaded from JSON file) with no external API calls.
 */

import creemeeData from '../data/creemeeStands.json' with { type: 'json' };

export interface CreemeeStand {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  description?: string;
  specialties?: string[];
  featured: boolean;
}

/**
 * Fetch all creemee stands
 * Returns static dataset loaded from JSON file
 */
export function fetchCreemeeStands(): Promise<CreemeeStand[]> {
  return Promise.resolve(creemeeData);
}

/**
 * Fetch only featured creemee stands
 * Featured stands are award-winners or highly rated
 */
export function fetchFeaturedStands(): Promise<CreemeeStand[]> {
  return Promise.resolve((creemeeData as CreemeeStand[]).filter(stand => stand.featured));
}

/**
 * Get a specific creemee stand by ID
 */
export function getCreemeeStandById(id: string): Promise<CreemeeStand | null> {
  const stand = (creemeeData as CreemeeStand[]).find(s => s.id === id);
  return Promise.resolve(stand || null);
}

/**
 * Get creemee stands by town
 */
export function getCreemeeStandsByTown(town: string): Promise<CreemeeStand[]> {
  return Promise.resolve((creemeeData as CreemeeStand[]).filter(
    s => s.town.toLowerCase() === town.toLowerCase()
  ));
}
