/**
 * Tests for NOAA -> Meteocons icon mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWeatherIconFromNOAAUrl,
  getWeatherIconName,
  isNightPeriod,
} from '../weatherIconMapping';

const icon = (path: string) => `https://api.weather.gov/icons/land/${path}?size=medium`;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('getWeatherIconFromNOAAUrl', () => {
  it.each([null, undefined, ''])('returns clear-day for %s', (input) => {
    expect(getWeatherIconFromNOAAUrl(input)).toBe('clear-day');
  });

  it.each([
    ['day/tornado', 'tornado'],
    ['night/hurricane', 'hurricane'],
    ['day/tropical_storm', 'hurricane'],
    ['day/blizzard', 'snow'],
    ['day/tsra', 'thunderstorms-day'],
    ['night/tsra_sct,40', 'thunderstorms-night'],
    ['day/tsra_hi/snow', 'thunderstorms-day-snow'],
    ['night/tsra/rain', 'thunderstorms-night-rain'],
    ['day/tsra/rain_showers', 'thunderstorms-day-rain'],
    ['day/rain_snow', 'sleet'],
    ['day/snow_rain', 'sleet'],
    ['day/rain_sleet', 'sleet'],
    ['day/snow_sleet', 'sleet'],
    ['day/fzra', 'sleet'],
    ['day/rain_fzra', 'sleet'],
    ['day/snow_fzra', 'sleet'],
    ['day/snow,20/sct', 'partly-cloudy-day-snow'],
    ['night/snow/few', 'partly-cloudy-night-snow'],
    ['day/snow/ovc', 'snow'],
    ['day/rain/few', 'partly-cloudy-day-rain'],
    ['night/rain_showers,40/bkn', 'partly-cloudy-night-rain'],
    ['day/rain_showers_hi/ovc', 'partly-cloudy-day-rain'],
    ['day/rain', 'rain'],
    ['day/sleet/sct', 'partly-cloudy-day-sleet'],
    ['day/sleet', 'sleet'],
    ['day/fog', 'fog-day'],
    ['night/haze', 'haze-night'],
    ['day/smoke', 'smoke-day'],
    ['day/dust', 'dust-day'],
    ['night/skc', 'clear-night'],
    ['day/few', 'partly-cloudy-day'],
    ['day/sct', 'partly-cloudy-day'],
    ['night/bkn', 'overcast-night'],
    ['day/ovc', 'overcast-day'],
    ['day/wind_skc', 'clear-day'],
    ['night/wind_few', 'partly-cloudy-night'],
    ['day/wind_sct', 'partly-cloudy-day'],
    ['day/wind_bkn', 'overcast-day'],
    ['day/wind_ovc', 'overcast-day'],
    ['day/hot', 'clear-day'],
    ['night/cold', 'clear-night'],
  ])('maps %s to %s', (path, expected) => {
    expect(getWeatherIconFromNOAAUrl(icon(path))).toBe(expected);
  });

  it('falls back to clear for unknown codes, respecting night', () => {
    expect(getWeatherIconFromNOAAUrl(icon('day/unicorns'))).toBe('clear-day');
    expect(getWeatherIconFromNOAAUrl(icon('night/unicorns'))).toBe('clear-night');
    expect(getWeatherIconFromNOAAUrl(icon('night/wind_unknown'))).toBe('clear-night');
  });

  it('falls back to clear-day when the URL has no day/night segment', () => {
    expect(getWeatherIconFromNOAAUrl('https://api.weather.gov/icons/land/rain')).toBe('clear-day');
  });

  it('falls back to clear-day for an unparseable URL', () => {
    expect(getWeatherIconFromNOAAUrl('not a url')).toBe('clear-day');
  });
});

describe('getWeatherIconName', () => {
  it.each([null, undefined, ''])('returns clear for %s', (input) => {
    expect(getWeatherIconName(input)).toBe('clear-day');
    expect(getWeatherIconName(input, true)).toBe('clear-night');
  });

  it.each([
    ['Thunderstorms', false, 'thunderstorms-day'],
    ['Thunderstorms and Snow', true, 'thunderstorms-night-snow'],
    ['Chance T-storms with Rain', false, 'thunderstorms-day-rain'],
    ['Tstorms then Showers', true, 'thunderstorms-night-rain'],
    ['Sleet', false, 'sleet'],
    ['Partly Cloudy with Freezing Rain', false, 'partly-cloudy-day-sleet'],
    ['Mostly Cloudy, Rain and Snow', true, 'overcast-night-sleet'],
    ['Heavy Ice Pellets', false, 'extreme-day-sleet'],
    ['Wintry Mix', false, 'sleet'],
    ['Rain, Freezing at times', false, 'sleet'],
    ['Partly Sunny, Chance Snow Showers', false, 'partly-cloudy-day-snow'],
    ['Heavy Snow', false, 'snow'],
    ['Flurries', true, 'snow'],
    ['Extreme Hail', false, 'extreme-day-hail'],
    ['Partly Cloudy, Hail', true, 'partly-cloudy-night-hail'],
    ['Overcast, Hail', false, 'overcast-day-hail'],
    ['Hail', false, 'hail'],
    ['Extreme Drizzle', false, 'extreme-day-drizzle'],
    ['Partly Cloudy, Drizzle', false, 'partly-cloudy-day-drizzle'],
    ['Mostly Cloudy, Drizzle', true, 'overcast-night-drizzle'],
    ['Drizzle', false, 'drizzle'],
    ['Heavy Rain', false, 'extreme-day-rain'],
    ['Partly Cloudy, Chance Rain Showers', true, 'partly-cloudy-night-rain'],
    ['Overcast with Showers', false, 'overcast-day-rain'],
    ['Rain', false, 'rain'],
    ['Extreme Fog', false, 'extreme-day-fog'],
    ['Partly Foggy', false, 'partly-cloudy-day-fog'],
    ['Overcast and Foggy', true, 'overcast-night-fog'],
    ['Patchy Fog', true, 'fog-night'],
    ['Extreme Haze', false, 'extreme-day-haze'],
    ['Hazy', true, 'haze-night'],
    ['Extreme Smoke', false, 'extreme-day-smoke'],
    ['Areas of Smoke', false, 'smoke-day'],
    ['Blowing Dust', false, 'dust-day'],
    ['Tornado', false, 'tornado'],
    ['Hurricane Conditions', false, 'hurricane'],
    ['Partly Cloudy', true, 'partly-cloudy-night'],
    ['Partly Sunny', false, 'partly-cloudy-day'],
    ['Mostly Cloudy', false, 'overcast-day'],
    ['Overcast', true, 'overcast-night'],
    ['Cloudy', false, 'cloudy'],
    ['Sunny', false, 'clear-day'],
    ['Mostly Clear', true, 'clear-night'],
    ['Fair', false, 'clear-day'],
    ['Increasing Clouds', false, 'cloudy'],
    ['Breezy', true, 'clear-night'],
  ])('maps "%s" (night=%s) to %s', (desc, night, expected) => {
    expect(getWeatherIconName(desc, night)).toBe(expected);
  });
});

describe('isNightPeriod', () => {
  it.each([
    ['Tonight', true],
    ['Monday Night', true],
    ['Overnight', true],
    ['Monday', false],
    ['This Afternoon', false],
    [null, false],
    [undefined, false],
  ])('%s -> %s', (name, expected) => {
    expect(isNightPeriod(name)).toBe(expected);
  });
});
