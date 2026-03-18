// src/controllers/alertsController.js
const { query }    = require('../db/pool');
const { auditLog } = require('../services/auditService');

exports.getAll = async (req, res, next) => {
  try {
    const { severity, vessel_id, acknowledged, limit = 50 } = req.query;
    let sql = `
      SELECT a.*, v.name AS vessel_name, v.callsign
      FROM alerts a
      LEFT JOIN vessels v ON v.id = a.vessel_id
      WHERE 1=1
    `;
    const params = [];
    if (severity)   { params.push(severity);   sql += ` AND a.severity = $${params.length}`; }
    if (vessel_id)  { params.push(vessel_id);  sql += ` AND a.vessel_id = $${params.length}`; }
    if (acknowledged !== undefined) {
      params.push(acknowledged === 'true');
      sql += ` AND a.is_acknowledged = $${params.length}`;
    }
    params.push(Math.min(parseInt(limit), 200));
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT a.*, v.name AS vessel_name FROM alerts a
      LEFT JOIN vessels v ON v.id = a.vessel_id WHERE a.id=$1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.acknowledge = async (req, res, next) => {
  try {
    const { rows } = await query(`
      UPDATE alerts SET
        is_acknowledged = TRUE,
        acknowledged_by = $1,
        acknowledged_at = NOW()
      WHERE id = $2 AND is_acknowledged = FALSE
      RETURNING *
    `, [req.user.id, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    await auditLog(req.user.id, 'ALERT_ACK', 'alerts', req.params.id, null, null, req.ip);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.acknowledgeAll = async (req, res, next) => {
  try {
    const { vessel_id } = req.body;
    let sql = `UPDATE alerts SET is_acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW() WHERE is_acknowledged=FALSE`;
    const params = [req.user.id];
    if (vessel_id) { params.push(vessel_id); sql += ` AND vessel_id=$${params.length}`; }
    sql += ' RETURNING id';
    const { rows } = await query(sql, params);
    await auditLog(req.user.id, 'ALERT_ACK_ALL', 'alerts', null, null, { count: rows.length }, req.ip);
    res.json({ acknowledged: rows.length });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { vessel_id, severity, category, title, message, metadata } = req.body;
    const { rows } = await query(`
      INSERT INTO alerts (vessel_id, severity, category, title, message, metadata)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [vessel_id || null, severity, category, title, message, JSON.stringify(metadata || {})]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE NOT is_acknowledged)                    AS unacknowledged,
        COUNT(*) FILTER (WHERE severity='CRITICAL' AND NOT is_acknowledged) AS critical_unacked,
        COUNT(*) FILTER (WHERE severity='WARNING'  AND NOT is_acknowledged) AS warning_unacked,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS last_hour,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
      FROM alerts
    `);
    res.json(rows[0]);
  } catch (err) { next(err); }
};
