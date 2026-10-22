# Test fixtures

**All fixtures in this directory are SYNTHETIC.** The test environment has no
network access, so nothing here was captured from a live upstream. Each file was
written by hand to match the shape the frontend parsers expect (see the
service/hook named below). If an upstream format changes, update the fixture
and the parser together.

| Fixture | Stands in for | Consumed by |
|---|---|---|
| `vt511/incidents.xml` | `GET {VITE_BACKEND_URL}/api/vt511/incidents` (backend proxy of the New England Compass XML portal, `https://nec-por.ne-compass.com/NEC.XmlDataPortal/`) | `src/services/vt511Api.ts` |
| `vt511/closures.xml` | `GET {VITE_BACKEND_URL}/api/vt511/closures` (same portal, lane closures feed) | `src/services/vt511Api.ts` |
| `usgs/iv-vt-gage-height.json` | `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=VT&parameterCd=00065&siteStatus=active` | `src/services/travelApi.ts` |
| `rainviewer/weather-maps.json` | `https://api.rainviewer.com/public/weather-maps.json` | `src/hooks/useRadarAnimation.ts` |
| `graphql/forecast.json` | Backend GraphQL `query Forecast` (`{VITE_GRAPHQL_ENDPOINT}`, default `http://localhost:4000/graphql`), which proxies `https://api.weather.gov/gridpoints/...` | `src/hooks/useForecast.ts`, `src/services/graphqlClient.ts` |
| `graphql/mergedAlerts.json` | Backend GraphQL `query MergedAlerts`, which proxies `https://api.weather.gov/alerts/active?area=VT` | `src/services/graphqlClient.ts` |

Timestamps in the USGS and RainViewer fixtures are fixed. Tests that depend on
"recent data" pin the clock with `vi.setSystemTime`.

To capture real responses for comparison, run `scripts/record-fixtures.sh` from the repo root (writes to the gitignored `fixtures-recorded/`).
