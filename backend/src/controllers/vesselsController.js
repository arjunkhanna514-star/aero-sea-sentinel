// src/controllers/vesselsController.js
const { query }    = require('../db/pool');
const { auditLog } = require('../services/auditService');

exports.getAll = async (req, res, next) => {
  try {
    const { type, status } = req.query;
    let sql = `
      SELECT v.*,
        (SELECT COUNT(*) FROM routes r WHERE r.vessel_id = v.id AND r.status='ACTIVE') AS active_routes,
        (SELECT time FROM telemetry t WHERE t.vessel_id = v.id ORDER BY t.time DESC LIMIT 1) AS last_telemetry
      FROM vessels v WHERE 1=1
    `;
    const params = [];
    if (type)   { params.push(type);   sql += ` AND v.type = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND v.status = $${params.length}`; }
    sql += ` ORDER BY v.name`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT v.*,
        (SELECT COUNT(*) FROM routes r WHERE r.vessel_id = v.id) AS total_routes,
        (SELECT SUM(fuel_savings_eur) FROM financial_snapshots f WHERE f.vessel_id = v.id) AS total_savings_eur
      FROM vessels v WHERE v.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Vessel not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, callsign, type, manufacturer, model, year_built,
            max_capacity_kg, fuel_capacity_l, smart_skin_enabled,
            smart_skin_panels, quantum_processor_id } = req.body;
    const { rows } = await query(`
      INSERT INTO vessels
        (name, callsign, type, manufacturer, model, year_built,
         max_capacity_kg, fuel_capacity_l, smart_skin_enabled,
         smart_skin_panels, quantum_processor_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'IDLE')
      RETURNING *
    `, [name, callsign, type, manufacturer, model, year_built,
        max_capacity_kg, fuel_capacity_l,
        smart_skin_enabled || false, smart_skin_panels || 0,
        quantum_processor_id || null]);
    await auditLog(req.user.id, 'VESSEL_CREATE', 'vessels', rows[0].id, null, rows[0], req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Callsign already exists' });
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['name','status','smart_skin_enabled','smart_skin_panels',
                     'quantum_processor_id','assigned_operator_id'];
    const sets    = [];
    const vals    = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        vals.push(req.body[key]);
        sets.push(`${key} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided' });
    vals.push(id);
    const { rows } = await query(
      `UPDATE vessels SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Vessel not found' });
    await auditLog(req.user.id, 'VESSEL_UPDATE', 'vessels', id, null, req.body, req.ip);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.getTelemetrySummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      SELECT
        time_bucket('1 hour', time) AS hour,
        ROUND(AVG(speed_knots)::numeric,2)         AS avg_speed,
        ROUND(AVG(fuel_burn_rate_lph)::numeric,2)  AS avg_burn_lph,
        ROUND(AVG(drag_reduction_pct)::numeric,2)  AS avg_drag_pct,
        ROUND(SUM(fuel_saved_l)::numeric,2)        AS fuel_saved_l,
        ROUND(AVG(quantum_coherence_pct)::numeric,2) AS avg_coherence,
        ROUND(AVG(co2_kg_per_hour)::numeric,3)     AS avg_co2,
        COUNT(*)                                   AS readings
      FROM telemetry
      WHERE vessel_id = $1 AND time > NOW() - INTERVAL '24 hours'
      GROUP BY hour ORDER BY hour DESC LIMIT 24
    `, [id]);
    res.json(rows);
  } catch (err) { next(err); }
};
