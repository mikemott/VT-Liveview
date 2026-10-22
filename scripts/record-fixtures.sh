#!/usr/bin/env bash
# Capture real upstream responses for comparison with the synthetic test fixtures.
#
# The fixtures in src/__fixtures__ and backend/src/__fixtures__ were written by hand
# (VTL-45: no network in the agent sandbox) and contain deliberate edge-case records
# that tests rely on. This script does NOT overwrite them: it saves real captures to
# fixtures-recorded/ (gitignored) so you can diff them and merge changes by hand.
#
# Usage: scripts/record-fixtures.sh [output-dir]
# The ArcGIS (ANR) and NCEI CDO URLs are long/token-gated; see the fixture READMEs.
set -euo pipefail

OUT="${1:-fixtures-recorded}"
UA="VT-LiveView fixture recorder (${CONTACT_EMAIL:-dev@example.com})"
mkdir -p "$OUT"

record() {
  local name="$1" url="$2"
  mkdir -p "$OUT/$(dirname "$name")"
  if curl -fsSL -m 30 -A "$UA" -o "$OUT/$name" "$url"; then
    echo "ok    $name"
  else
    echo "FAIL  $name  ($url)" >&2
  fi
}

# Backend services (backend/src/__fixtures__)
record noaa/points.json "https://api.weather.gov/points/44.4759,-73.2121"
record noaa/stations.json "https://api.weather.gov/gridpoints/BTV/89,56/stations"
record noaa/observation-latest.json "https://api.weather.gov/stations/KBTV/observations/latest"
record noaa/forecast.json "https://api.weather.gov/gridpoints/BTV/89,56/forecast"
record noaa/alerts-vt.json "https://api.weather.gov/alerts/active?area=VT"
record noaa/zone-VTZ005.json "https://api.weather.gov/zones/forecast/VTZ005"
record noaa/zone-VTZ006.json "https://api.weather.gov/zones/forecast/VTZ006"
record usgs/lake-champlain-iv.json "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=04294500&parameterCd=00010&siteStatus=active"
record iem/radar.json "https://mesonet.agron.iastate.edu/json/radar.py"
record rainviewer/weather-maps.json "https://api.rainviewer.com/public/weather-maps.json"
record skivermont/conditions.html "https://skivermont.com/conditions"
record burlington/beach-status.json "https://maps.burlingtonvt.gov/arcgis/rest/services/BTV_Beach_Status/MapServer/0/query?where=1%3D1&outFields=*&f=json"

# Frontend (src/__fixtures__)
record usgs/iv-vt-gage-height.json "https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=VT&parameterCd=00065&siteStatus=active"

echo "Saved to $OUT/. Compare with the fixtures and merge by hand; keep the edge-case records tests rely on."
