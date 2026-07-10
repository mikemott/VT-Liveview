import { fetchBeachWaterQuality } from '../services/beachWaterQuality.js';

export const beachResolvers = {
  Query: {
    beaches: async () => {
      return await fetchBeachWaterQuality();
    },
  },
};
