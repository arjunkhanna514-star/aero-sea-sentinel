// src/controllers/financialsController.js
const { query } = require('../db/pool');

exports.getFleetKPIs = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT * FROM fleet_kpis ORDER BY recorded_at DESC LIMIT 1
    `);
    res.json(rows[0] || {});
  } catch (err) { next(err); }
};

exports.getSavingsSummary = async (req, res, next) => {
  try {
    // Cumulative savings with vessel breakdown
    const { rows } = await query(`
      SELECT
        SUM(fuel_savings_eur)        AS total_fuel_savings_eur,
        SUM(ship_savings_eur)        AS total_ship_savings_eur,
        SUM(aircraft_savings_eur)    AS total_aircraft_savings_eur,
        SUM(smart_skin_savings_eur)  AS total_smart_skin_savings_eur,
        SUM(shanghai_la_savings_eur) AS shanghai_la_savings_eur,
        MAX(snapshot_date)           AS as_of_date
      FROM financial_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
        AND vessel_id IS NULL
    `);
    // Targets from product brief
    const targets = {
      ship_annual_target_eur:    500000,
      aircraft_annual_target_eur: 1200000,
      monthly_ship_target_eur:   40000,
      monthly_aircraft_target_eur: 100000,
    };
    res.json({ ...rows[0], targets });
  } catch (err) { next(err); }
};

exports.getProjections = async (req, res, next) => {
  try {
    // 12-month projection based on last 30 days trend
    const { rows } = await query(`
      SELECT
        snapshot_date,
        total_savings_eur,
        fuel_savings_eur,
        ship_savings_eur,
        aircraft_savings_eur
      FROM financial_snapshots
      WHERE vessel_id IS NULL
      ORDER BY snapshot_date DESC
      LIMIT 30
    `);
    const monthly = rows.reduce((s, r) => s + parseFloat(r.total_savings_eur || 0), 0);
    const projected_annual = monthly * (365 / 30);
    res.json({ monthly_data: rows, projected_annual_eur: Math.round(projected_annual) });
  } catch (err) { next(err); }
};

exports.getDragEfficiency = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        time_bucket('1 hour', time) AS hour,
        v.name AS vessel_name,
        v.type AS vessel_type,
        ROUND(AVG(t.drag_reduction_pct)::numeric, 2) AS avg_drag_reduction,
        ROUND(AVG(t.drag_coefficient)::numeric, 6)   AS avg_drag_coeff,
        SUM(t.micro_adjustment_count)                 AS total_micro_adjustments
      FROM telemetry t
      JOIN vessels v ON v.id = t.vessel_id
      WHERE t.time > NOW() - INTERVAL '24 hours'
      GROUP BY hour, v.name, v.type
      ORDER BY hour DESC, avg_drag_reduction DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getCaseStudies = async (_req, res) => {
  res.json([
    {
      id: 'shanghai-la',
      title: 'Shanghai → Los Angeles',
      vessel: 'MV Shanghai Express',
      type: 'SHIP',
      monthly_savings_eur: 41250,
      annual_savings_eur:  495000,
      target_eur:          500000,
      drag_reduction_pct:  17.2,
      fuel_saved_l_month:  124000,
      co2_saved_kg_month:  328960,
      smart_skin_panels:   1980,
      quantum_swarm_active: true,
      route_distance_nm:   5480,
      description: 'Quantum Swarm-optimised trans-Pacific routing combined with Smart Skin micro-adjustments delivering 17.2% drag reduction.',
    },
    {
      id: 'horizon-eagle',
      title: 'Intercontinental Cargo Routes',
      vessel: 'AS Horizon Eagle',
      type: 'AIRCRAFT',
      monthly_savings_eur: 102400,
      annual_savings_eur:  1228800,
      target_eur:          1200000,
      drag_reduction_pct:  18.4,
      fuel_saved_l_month:  89600,
      co2_saved_kg_month:  227680,
      smart_skin_panels:   840,
      jet_stream_optimised: true,
      description: 'AI jet stream optimisation + Smart Skin laminar flow control achieving €1.2M+ annual fuel savings — 2.4% above target.',
    },
  ]);
};
