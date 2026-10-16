# Test fixtures

**All fixtures here are synthetic.** The test sandbox has no network access, so
they were written by hand from each upstream's documented response format and from
the TypeScript types and parsing code in `src/services/`. They are deliberately small
(a few records each) and include edge-case records such as missing names,
out-of-state coordinates and null values.

To re-record a real response, fetch the URL listed below and save the body over the
fixture. Keep any edge-case records the tests rely on, or update the tests to match.

`load.ts` provides `loadJson()` and `loadText()`, which read a fixture by path
relative to this directory.

## Services fixtures

| Fixture | Stands in for |
|---|---|
| `noaa/points.json` | `https://api.weather.gov/points/44.4759,-73.2121` |
| `noaa/stations.json` | `https://api.weather.gov/gridpoints/BTV/89,56/stations` (the `observationStations` URL from the points response) |
| `noaa/observation-latest.json` | `https://api.weather.gov/stations/KBTV/observations/latest` |
| `noaa/forecast.json` | `https://api.weather.gov/gridpoints/BTV/89,56/forecast` |
| `noaa/alerts-vt.json` | `https://api.weather.gov/alerts/active?area=VT` |
| `noaa/zone-VTZ005.json` | `https://api.weather.gov/zones/forecast/VTZ005` (Polygon geometry) |
| `noaa/zone-VTZ006.json` | `https://api.weather.gov/zones/forecast/VTZ006` (MultiPolygon geometry) |
| `usgs/lake-champlain-iv.json` | `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=04294500&parameterCd=00010&siteStatus=active` |
| `ncei-cdo/data-ghcnd.json` | `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&stationid=GHCND:USC00431705&startdate=…&enddate=…&datatypeid=TMAX,TMIN,PRCP,SNOW&units=standard&limit=1000` (needs a `token` header) |
| `iem/radar.json` | `https://mesonet.agron.iastate.edu/json/radar.py` (the service only checks that it is reachable and is valid JSON) |
| `rainviewer/weather-maps.json` | `https://api.rainviewer.com/public/weather-maps.json` |
| `skivermont/conditions.html` | `https://skivermont.com/conditions` (only the `.widget_resort_conditions .card` markup the scraper reads) |
| `burlington/beach-status.json` | `https://maps.burlingtonvt.gov/arcgis/rest/services/BTV_Beach_Status/MapServer/0/query?where=1%3D1&outFields=*&f=json` |
| `anr/recreation-sites.json` | `https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer/166/query?where=F_CAMP%3D'Y'+OR+…&outFields=*&f=json&returnGeometry=true` |
| `anr/backcountry-campsites.json` | `https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer/175/query?where=Type+IN+(1,2,3,4,5,6)&outFields=…&f=json&returnGeometry=true` |
| `anr/park-boundaries.geojson` | `https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_CADASTRAL_SP_NOCACHE_v2/MapServer/38/query?where=ANRDept%3D'FPR'&outFields=…&f=geojson&returnGeometry=true` |

The recreation and backcountry services reject responses with fewer than 20 or 50
valid sites. The tests pad these fixtures by cloning the first record
(`src/services/__tests__/arcgisFixtures.ts`), so the files can stay small.

Other directories (for example `collectors/`) belong to other test suites.
