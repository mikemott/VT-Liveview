-- VT-LiveView Initial Database Schema
-- Supports both PostgreSQL (Neon/Supabase) and TimescaleDB

-- Weather observations from NOAA stations
CREATE TABLE IF NOT EXISTS weather_observations (
  id BIGSERIAL PRIMARY KEY,
  station_id VARCHAR(20) NOT NULL,
  station_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  temperature_f DECIMAL(5,1),
  humidity DECIMAL(5,2),
  wind_speed_mph DECIMAL(5,1),
  wind_direction VARCHAR(3),
  pressure_mb INTEGER,
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for deduplication (also serves as index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_weather_obs_station_time
  ON weather_observations(station_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_weather_obs_observed_at
  ON weather_observations(observed_at DESC);

-- Weather alerts from NOAA
CREATE TABLE IF NOT EXISTS weather_alerts (
  id BIGSERIAL PRIMARY KEY,
  noaa_alert_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  certainty VARCHAR(20) NOT NULL,
  urgency VARCHAR(20) NOT NULL,
  headline TEXT,
  description TEXT,
  instruction TEXT,
  area_desc TEXT,
  affected_zones TEXT[],
  geometry JSONB,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_event_type ON weather_alerts(event_type);
CREATE INDEX IF NOT EXISTS idx_alerts_expires ON weather_alerts(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON weather_alerts(severity);

-- Traffic incidents from VT 511
CREATE TABLE IF NOT EXISTS traffic_incidents (
  id BIGSERIAL PRIMARY KEY,
  source_id VARCHAR(100) NOT NULL UNIQUE,
  incident_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  road_name VARCHAR(255),
  affected_lanes VARCHAR(255),
  geometry JSONB,
  started_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL DEFAULT 'VT 511'
);

CREATE INDEX IF NOT EXISTS idx_incidents_type ON traffic_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_active ON traffic_incidents(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_time ON traffic_incidents(first_seen_at DESC);

-- River gauge readings from USGS
CREATE TABLE IF NOT EXISTS river_gauges (
  id BIGSERIAL PRIMARY KEY,
  site_code VARCHAR(20) NOT NULL,
  site_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  gage_height_ft DECIMAL(8,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_code, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_gauges_site_time ON river_gauges(site_code, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gauges_observed_at ON river_gauges(observed_at DESC);

-- Optional: TimescaleDB hypertables (only if TimescaleDB extension is available)
-- Uncomment these if using Timescale Cloud:
-- SELECT create_hypertable('weather_observations', 'observed_at',
--   chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);
-- SELECT create_hypertable('river_gauges', 'observed_at',
--   chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);
