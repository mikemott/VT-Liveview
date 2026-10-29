# 0004: Data sources for rivers, normals, EV chargers and fire danger

- **Date:** 2026-10-28
- **Issue:** VTL-81

## Decision
- **River levels: NWS National Water Prediction Service** (`api.water.noaa.gov/nwps/v1`). It
  covers the same gauges as USGS but adds the NWS flood categories (observed and forecast), flood
  stages, impact statements, historic crests and the hydrograph forecast. No key.
- **Normals and records: RCC-ACIS** (`data.rcc-acis.org/StnData`). One call gives 1991-2020
  daily normals, another the period-of-record extremes for the day. No key. We use nine fixed
  long-record stations and pick the nearest. Burlington uses the threaded record (`BTVthr`).
  Southern Vermont has no long-record station of its own, so it uses Keene NH and Pittsfield MA.
- **EV chargers: DOE AFDC** at `developer.nlr.gov`. The `developer.nrel.gov` host no longer
  answers since NREL's rename. Takes `AFDC_API_KEY`, falling back to `DEMO_KEY` (30 requests/hour
  per IP, enough for one request per 12-hour cache). DC fast chargers show statewide; Level 2
  only from zoom 11 in.
- **Fire danger: ANR's public "Vermont Fire Danger - Public" feature service.** This is the data
  behind FPR's daily map. The five rating areas are numbered only, so we named them from FPR's
  town list.
- **Auto-show layers:** Rivers (minor flooding or worse, observed or forecast) and Fire danger
  (High or worse, and current) turn themselves on until the user toggles them. This is
  `autoShown` in `WeatherMap.tsx`.

## Why
- **NWPS:** it already tells us whether a river is flooding. With USGS alone we'd have to
  maintain flood stages ourselves.
- **ACIS:** NCEI's CDO API needs a token and has no "record for this day" query. ACIS answers
  both questions directly.
- **Fire danger:** it's FPR's official rating. Computing NFDRS classes ourselves from FEMS
  station data could disagree with the state.
- **Auto-show:** the seasonal closures layer already works this way. A flood or a fire-danger
  day is when people need these layers, and that's when they'd least expect to go looking.

## Rejected alternatives
- **Fire danger from the editing service (`Vermont_Fire_Danger` without "- Public"):** needs a
  token. It belongs to FPR's internal editor app.
- **Fire danger from the daily JPEG, or computed from FEMS / WFAS:** the JPEG is an image, not
  data, and WFAS publishes only images. FEMS outputs aren't the state's rating.
- **Ferry status (Lake Champlain Transportation):** ferries.com blocks automated requests
  (HTTP 406 from mod_security). We don't work around bot blocking. Ferries are left for Mike
  to decide (static routes with seasons, or ask LCT for a feed).
- **Clustering 550 EV markers in a MapLibre symbol layer:** it would break the shared-marker
  pattern (keyboard access, side panel). Gating Level 2 by zoom keeps the DOM marker count
  near 110.
