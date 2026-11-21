import { describe, expect, it } from 'vitest';
import {
  afdcStationUrl,
  nwpsGaugeUrl,
  nwsAlertSource,
  nwsPointForecastUrl,
  nwsStationHistoryUrl,
  nwsZoneUrl,
  safeHttpsUrl,
  SOURCES,
  stationSource,
  usgsSiteUrl,
} from '../sourceLinks';

/** A public page: https, and not an API host */
function expectPublicPage(url: string): void {
  const { protocol, hostname, pathname, search } = new URL(url);
  expect(protocol).toBe('https:');
  expect(hostname).not.toMatch(/^(api|developer)\./);
  expect(pathname).not.toMatch(/\/arcgis\/rest\//);
  expect(search).not.toMatch(/api_?key/i);
}

describe('source link builders (VTL-96)', () => {
  it('builds each pattern', () => {
    expect(nwsZoneUrl('VTZ006')).toBe('https://forecast.weather.gov/MapClick.php?zoneid=VTZ006');
    expect(nwsPointForecastUrl(44.4759, -73.21207)).toBe(
      'https://forecast.weather.gov/MapClick.php?lat=44.4759&lon=-73.2121',
    );
    expect(nwsStationHistoryUrl('KBTV')).toBe('https://www.weather.gov/wrh/timeseries?site=KBTV');
    expect(nwpsGaugeUrl('ESSV1')).toBe('https://water.noaa.gov/gauges/ESSV1');
    expect(usgsSiteUrl('04294500')).toBe(
      'https://waterdata.usgs.gov/monitoring-location/04294500/',
    );
    expect(afdcStationUrl('102480')).toBe('https://afdc.energy.gov/stations#/station/102480');
  });

  it('encodes ids', () => {
    expect(nwsStationHistoryUrl('K BTV&x=1')).toBe(
      'https://www.weather.gov/wrh/timeseries?site=K%20BTV%26x%3D1',
    );
    expect(nwpsGaugeUrl('../admin')).toBe('https://water.noaa.gov/gauges/..%2Fadmin');
    expect(usgsSiteUrl('1/2')).toBe('https://waterdata.usgs.gov/monitoring-location/1%2F2/');
    expect(afdcStationUrl('1?x')).toBe('https://afdc.energy.gov/stations#/station/1%3Fx');
  });

  it('links an alert to its first forecast zone, else weather.gov', () => {
    expect(nwsAlertSource({ properties: { affectedZoneIds: ['VTC007', 'VTZ006'] } })).toEqual({
      name: 'National Weather Service',
      href: 'https://forecast.weather.gov/MapClick.php?zoneid=VTZ006',
    });
    expect(nwsAlertSource({ properties: { affectedZoneIds: ['bogus"><x'] } }).href).toBe(
      'https://www.weather.gov/',
    );
    expect(nwsAlertSource({ properties: {} }).href).toBe('https://www.weather.gov/');
  });

  it('credits USGS for the USGS water temperature station and NWS otherwise', () => {
    expect(stationSource('USGS-04294500')).toEqual({
      name: 'U.S. Geological Survey',
      href: 'https://waterdata.usgs.gov/monitoring-location/04294500/',
    });
    expect(stationSource('KMPV')).toEqual({
      name: 'National Weather Service',
      href: 'https://www.weather.gov/wrh/timeseries?site=KMPV',
    });
  });

  it('only fixed sources that are public https pages', () => {
    for (const source of Object.values(SOURCES)) expectPublicPage(source.href);
  });

  it('accepts only https upstream URLs', () => {
    expect(safeHttpsUrl('https://ferries.com/')).toBe('https://ferries.com/');
    expect(safeHttpsUrl('http://ferries.com/')).toBeNull();
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('not a url')).toBeNull();
    expect(safeHttpsUrl('')).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});
