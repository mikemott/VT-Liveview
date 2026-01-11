import { getCurrentWeather, getForecast, getAlerts } from '../services/noaa.js';
import { getRadarInfo } from '../services/radar.js';

export const resolvers = {
  Query: {
    currentWeather: async (_, { lat, lon }) => {
      return await getCurrentWeather(lat, lon);
    },

    forecast: async (_, { lat, lon }) => {
      return await getForecast(lat, lon);
    },

    alerts: async (_, { state }) => {
      return await getAlerts(state);
    },

    radarInfo: async () => {
      return await getRadarInfo();
    }
  }
};
