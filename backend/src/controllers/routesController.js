// src/controllers/routesController.js
const { query } = require('../db/pool');
const { auditLog } = require('../services/auditService');

exports.getAll = async (req, res, next) => {
  try {
    const { status, vessel_id } = req.query;
    let sql = `
      SELECT r.*, v.name AS vessel_name, v.callsign, v.type AS vessel_type,
             creator.full_name AS created_by_name,
             approver.full_name AS approved_by_name
      FROM routes r
      JOIN vessels v ON v.id = r.vessel_id
      LEFT JOIN users creator  ON creator.id  = r.created_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      WHERE 1=1
    `;
    const params = [];
    if (status)    { params.push(status);    sql += ` AND r.status = $${params.length}`; }
    if (vessel_id) { params.push(vessel_id); sql += ` AND r.vessel_id = $${params.length}`; }
    sql += ` ORDER BY r.created_at DESC LIMIT 100`;

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*, v.name AS vessel_name, v.callsign
      FROM routes r JOIN vessels v ON v.id = r.vessel_id
      WHERE r.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Route not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { vessel_id, name, origin, destination, waypoints,
            is_quantum_swarm, swarm_confidence, estimated_fuel_cost_eur } = req.body;
    const { rows } = await query(`
      INSERT INTO routes (vessel_id, name, origin, destination, waypoints,
                          is_quantum_swarm, swarm_confidence, estimated_fuel_cost_eur,
                          status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9)
      RETURNING *
    `, [vessel_id, name, origin, destination,
        JSON.stringify(waypoints || []),
        is_quantum_swarm || false,
        swarm_confidence || null,
        estimated_fuel_cost_eur || null,
        req.user.id]);
    await auditLog(req.user.id, 'ROUTE_CREATE', 'routes', rows[0].id, null, rows[0], req.ip);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

// FLEET_MANAGER or SENIOR_OPERATOR approve/reject
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejection_note } = req.body;

    // Only FLEET_MANAGER/SENIOR_OPERATOR can approve
    if (status === 'APPROVED' && !['FLEET_MANAGER','ADMIN','SENIOR_OPERATOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role to approve routes' });
    }

    const { rows } = await query(`
      UPDATE routes SET
        status = $1,
        approved_by = $2,
        approved_at = CASE WHEN $1='APPROVED' THEN NOW() ELSE NULL END,
        rejection_note = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [status, req.user.id, rejection_note || null, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Route not found' });
    await auditLog(req.user.id, `ROUTE_${status}`, 'routes', id, null, { status }, req.ip);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// Quantum Swarm requests (SENIOR_OPERATOR approval gate)
exports.createSwarmRequest = async (req, res, next) => {
  try {
    const { route_id, vessel_id, proposed_waypoints, swarm_rationale, fuel_delta_eur, time_delta_min } = req.body;
    const { rows: route } = await query(`SELECT waypoints FROM routes WHERE id=$1`,[route_id]);
    if (!route[0]) return res.status(404).json({ error: 'Route not found' });

    const { rows } = await query(`
      INSERT INTO quantum_swarm_requests
        (route_id, vessel_id, requested_by, original_waypoints, proposed_waypoints,
         swarm_rationale, fuel_delta_eur, time_delta_min)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [route_id, vessel_id, req.user.id,
        route[0].waypoints, JSON.stringify(proposed_waypoints),
        swarm_rationale, fuel_delta_eur, time_delta_min]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.reviewSwarmRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'APPROVED' | 'REJECTED'

    const { rows } = await query(`
      UPDATE quantum_swarm_requests SET
        decision = $1, reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $3 RETURNING *
    `, [decision, req.user.id, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });

    // If approved, update route waypoints
    if (decision === 'APPROVED') {
      await query(`
        UPDATE routes SET waypoints = $1, updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(rows[0].proposed_waypoints), rows[0].route_id]);
    }
    await auditLog(req.user.id, `SWARM_${decision}`, 'quantum_swarm_requests', id, null, { decision }, req.ip);
    res.json(rows[0]);
  } catch (err) { next(err); }
};
