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
export async function fetchCreemeeStands(): Promise<CreemeeStand[]> {
  return creemeeData as CreemeeStand[];
}

/**
 * Fetch only featured creemee stands
 * Featured stands are award-winners or highly rated
 */
export async function fetchFeaturedStands(): Promise<CreemeeStand[]> {
  return (creemeeData as CreemeeStand[]).filter(stand => stand.featured);
}

/**
 * Get a specific creemee stand by ID
 */
export async function getCreemeeStandById(id: string): Promise<CreemeeStand | null> {
  const stand = (creemeeData as CreemeeStand[]).find(s => s.id === id);
  return stand || null;
}

/**
 * Get creemee stands by town
 */
export async function getCreemeeStandsByTown(town: string): Promise<CreemeeStand[]> {
  return (creemeeData as CreemeeStand[]).filter(
    s => s.town.toLowerCase() === town.toLowerCase()
  );
}
