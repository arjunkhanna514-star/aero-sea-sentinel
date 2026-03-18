// src/controllers/telemetryController.js
const { query } = require('../db/pool');

/**
 * GET /telemetry/live — latest reading per vessel (all active vessels)
 */
exports.getLive = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT ON (vessel_id)
        t.*,
        v.name AS vessel_name,
        v.callsign,
        v.type AS vessel_type,
        v.status AS vessel_status
      FROM telemetry t
      JOIN vessels v ON v.id = t.vessel_id
      WHERE v.status = 'ACTIVE'
      ORDER BY vessel_id, time DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /telemetry/:vesselId/latest
 */
exports.getLatestForVessel = async (req, res, next) => {
  try {
    const { vesselId } = req.params;
    const { rows } = await query(`
      SELECT t.*, v.name, v.callsign, v.type, v.smart_skin_panels
      FROM telemetry t
      JOIN vessels v ON v.id = t.vessel_id
      WHERE t.vessel_id = $1
      ORDER BY t.time DESC
      LIMIT 1
    `, [vesselId]);
    if (!rows[0]) return res.status(404).json({ error: 'Vessel not found or no data' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /telemetry/:vesselId/history?hours=24&interval=5m
 */
exports.getHistory = async (req, res, next) => {
  try {
    const { vesselId } = req.params;
    const hours    = Math.min(parseInt(req.query.hours || '24'), 168); // max 1 week
    const interval = req.query.interval || '5 minutes';

    const { rows } = await query(`
      SELECT
        time_bucket($1, time) AS bucket,
        AVG(fuel_burn_rate_lph)  AS avg_fuel_burn,
        AVG(drag_coefficient)    AS avg_drag,
        AVG(speed_knots)         AS avg_speed,
        AVG(quantum_temp_celsius) AS avg_quantum_temp,
        SUM(fuel_saved_l)        AS total_fuel_saved,
        AVG(drag_reduction_pct)  AS avg_drag_reduction,
        AVG(co2_kg_per_hour)     AS avg_co2
      FROM telemetry
      WHERE vessel_id = $2
        AND time > NOW() - INTERVAL '1 hour' * $3
      GROUP BY bucket
      ORDER BY bucket DESC
    `, [interval, vesselId, hours]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /telemetry — ingest single reading (from IoT gateway / simulator)
 */
exports.ingest = async (req, res, next) => {
  try {
    const d = req.body;
    await query(`
      INSERT INTO telemetry (
        time, vessel_id,
        latitude, longitude, altitude_m, heading_deg, speed_knots,
        fuel_level_pct, fuel_burn_rate_lph, fuel_saved_l,
        drag_coefficient, drag_reduction_pct, smart_skin_active_zones, micro_adjustment_count,
        quantum_temp_celsius, quantum_cpu_load_pct, quantum_coherence_pct,
        lidar_range_m, lidar_object_count, lidar_visibility_pct,
        wind_speed_ms, wind_direction_deg, wave_height_m, jet_stream_velocity_ms,
        sea_temp_celsius, air_temp_celsius, co2_kg_per_hour
      ) VALUES (
        NOW(), $1,
        $2,$3,$4,$5,$6,
        $7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,
        $17,$18,$19,
        $20,$21,$22,$23,
        $24,$25,$26
      )
    `, [
      d.vessel_id,
      d.latitude, d.longitude, d.altitude_m, d.heading_deg, d.speed_knots,
      d.fuel_level_pct, d.fuel_burn_rate_lph, d.fuel_saved_l ?? 0,
      d.drag_coefficient, d.drag_reduction_pct, d.smart_skin_active_zones ?? 0, d.micro_adjustment_count ?? 0,
      d.quantum_temp_celsius, d.quantum_cpu_load_pct, d.quantum_coherence_pct,
      d.lidar_range_m, d.lidar_object_count ?? 0, d.lidar_visibility_pct,
      d.wind_speed_ms, d.wind_direction_deg, d.wave_height_m, d.jet_stream_velocity_ms,
      d.sea_temp_celsius, d.air_temp_celsius, d.co2_kg_per_hour,
    ]);
    res.status(201).json({ message: 'Telemetry ingested' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /telemetry/fleet/summary — aggregated fleet metrics
 */
exports.getFleetSummary = async (req, res, next) => {
  try {
    const { rows } = await query(`
      WITH latest AS (
        SELECT DISTINCT ON (vessel_id)
          vessel_id, fuel_burn_rate_lph, drag_reduction_pct,
          quantum_temp_celsius, quantum_coherence_pct,
          fuel_saved_l, co2_kg_per_hour, speed_knots
        FROM telemetry
        ORDER BY vessel_id, time DESC
      )
      SELECT
        COUNT(*) AS active_vessels,
        ROUND(AVG(drag_reduction_pct),2)    AS avg_drag_reduction_pct,
        ROUND(AVG(quantum_coherence_pct),2) AS avg_quantum_coherence,
        ROUND(SUM(fuel_burn_rate_lph),2)    AS total_fuel_burn_lph,
        ROUND(SUM(fuel_saved_l),2)          AS total_fuel_saved_today_l,
        ROUND(SUM(co2_kg_per_hour),2)       AS total_co2_per_hour,
        ROUND(AVG(speed_knots),1)           AS avg_speed_knots
      FROM latest
    `);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
