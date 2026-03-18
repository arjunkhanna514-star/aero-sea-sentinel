-- database/migrations/002_timescale_policies.sql
-- TimescaleDB compression + data retention policies for telemetry hypertable

-- ─── Compression: compress chunks older than 1 day ───────────
ALTER TABLE telemetry SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_id',
  timescaledb.compress_orderby   = 'time DESC'
);

SELECT add_compression_policy('telemetry', INTERVAL '1 day');

-- ─── Retention: drop chunks older than 90 days ───────────────
-- (keep financial + route data forever; only raw telemetry rotates)
SELECT add_retention_policy('telemetry', INTERVAL '90 days');

-- ─── Continuous aggregates: hourly rollup ─────────────────────
CREATE MATERIALIZED VIEW telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time)     AS hour,
  vessel_id,
  AVG(speed_knots)                AS avg_speed,
  AVG(fuel_burn_rate_lph)         AS avg_burn_lph,
  SUM(fuel_saved_l)               AS total_fuel_saved,
  AVG(drag_reduction_pct)         AS avg_drag_pct,
  AVG(drag_coefficient)           AS avg_drag_coeff,
  SUM(micro_adjustment_count)     AS total_micro_adj,
  AVG(quantum_temp_celsius)       AS avg_quantum_temp,
  AVG(quantum_cpu_load_pct)       AS avg_quantum_cpu,
  AVG(quantum_coherence_pct)      AS avg_coherence,
  AVG(lidar_range_m)              AS avg_lidar_range,
  MAX(lidar_object_count)         AS max_objects,
  AVG(wind_speed_ms)              AS avg_wind,
  AVG(wave_height_m)              AS avg_wave,
  AVG(co2_kg_per_hour)            AS avg_co2,
  SUM(co2_kg_per_hour) / 3600     AS total_co2_kg,
  COUNT(*)                        AS readings
FROM telemetry
GROUP BY hour, vessel_id
WITH NO DATA;

-- Refresh policy: keep hourly aggregate up to date
SELECT add_continuous_aggregate_policy('telemetry_hourly',
  start_offset => INTERVAL '2 hours',
  end_offset   => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 hour'
);

-- ─── Daily rollup ─────────────────────────────────────────────
CREATE MATERIALIZED VIEW telemetry_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', hour)      AS day,
  vessel_id,
  AVG(avg_speed)                  AS avg_speed,
  AVG(avg_burn_lph)               AS avg_burn_lph,
  SUM(total_fuel_saved)           AS fuel_saved_l,
  AVG(avg_drag_pct)               AS avg_drag_pct,
  SUM(total_micro_adj)            AS total_micro_adj,
  AVG(avg_coherence)              AS avg_coherence,
  SUM(total_co2_kg)               AS total_co2_kg,
  SUM(readings)                   AS total_readings
FROM telemetry_hourly
GROUP BY day, vessel_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry_daily',
  start_offset => INTERVAL '2 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 day'
);

-- ─── Indexes on aggregates ────────────────────────────────────
CREATE INDEX ON telemetry_hourly (vessel_id, hour DESC);
CREATE INDEX ON telemetry_daily  (vessel_id, day  DESC);
