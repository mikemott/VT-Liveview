import { fetchBeachWaterQuality } from '../services/beachWaterQuality.js';

export const beachResolvers = {
  Query: {
    beaches: async () => {
      try {
        return await fetchBeachWaterQuality();
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('GraphQL resolver error (beaches):', error);
        }
        throw new Error('Failed to fetch beach water quality data');
      }
    },
  },
};
