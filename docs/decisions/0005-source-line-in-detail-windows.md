# 0005: One linked source line in every detail window

- **Date:** 2026-11-21
- **Issue:** VTL-96

## Decision
Every detail view and the alert popup ends with `DetailSource`
(`src/components/detail-views/DetailParts.tsx`), which takes structured
`sources: { name, href }[]` plus an optional note as children, and renders
"Source: <a>A</a> and <a>B</a> · note". Hand-made lists pass `curated` and
read "Curated by VT LiveView" (from <a>X</a> when they draw on a source).

All link patterns live in `src/utils/sourceLinks.ts`:
- Names are organizations ("National Weather Service"), not APIs.
- Links go to public pages, per item where a stable page exists: NWS zone
  forecast for alerts, NWS station history, NWPS gauge, USGS monitoring
  location, AFDC station.
- Ids go through `encodeURIComponent`. URLs from upstream data (`networkUrl`,
  `operatorUrl`, webcam pages) pass `safeHttpsUrl` (https only).
- Long caveats that used to sit in the footer moved to a `detail-note`
  paragraph above it, so the footer stays one short line.

Specific choices:
- Alerts are merged across NWS alert ids, so there's no single alert page. The
  link goes to the forecast page of the alert's first Vermont forecast zone
  (it lists that zone's active alerts), else weather.gov.
- Only Burlington's beaches are tested. A beach with a test result or a status
  credits the City of Burlington. Other beaches are our own list ("Curated",
  crediting Vermont State Parks for state-park beaches).
- Creemee stands: dropped "Licensed by the Vermont Agency of Agriculture". The
  list is hand-curated, and the Agency publishes no licensee list we could
  check it against.
- Campgrounds and backcountry areas link the ANR open-data portal
  (geodata.vermont.gov), since the campground layer includes private sites.

## Why
The issue asks for a consistent, linked source in every window, with no API
endpoints or keys in links. Keeping the patterns in one module makes them easy
to test and audit.

## Rejected alternatives
- Free-text sources per view (the old way): inconsistent and unlinked.
- Linking `api.weather.gov` alert ids or ArcGIS/AirNow API URLs: not readable
  by people, and AirNow's carries a key.
- AirNow city pages (`?city=&state=`): monitors don't carry a reliable city and
  state, so a wrong page is likely. We link airnow.gov.
