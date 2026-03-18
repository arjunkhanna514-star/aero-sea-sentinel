// src/controllers/adminController.js
const bcrypt      = require('bcryptjs');
const { query }   = require('../db/pool');
const { auditLog }= require('../services/auditService');

// ─── Users ────────────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, email, full_name, role, is_active, last_login, created_at,
             (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = users.id AND s.expires_at > NOW()) AS active_sessions
      FROM users ORDER BY role, full_name
    `);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { email, password, full_name, role } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ($1,$2,$3,$4) RETURNING id, email, full_name, role, is_active, created_at
    `, [email.toLowerCase().trim(), hash, full_name.trim(), role]);
    await auditLog(req.user.id, 'USER_CREATE', 'users', rows[0].id, null, { email, role }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, role, is_active } = req.body;
    // Prevent admin from deactivating themselves
    if (id === req.user.id && is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    const { rows } = await query(`
      UPDATE users SET
        full_name = COALESCE($1, full_name),
        role      = COALESCE($2, role),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4 RETURNING id, email, full_name, role, is_active
    `, [full_name, role, is_active, id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await auditLog(req.user.id, 'USER_UPDATE', 'users', id, null, req.body, req.ip);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 10) {
      return res.status(400).json({ error: 'Password min 10 chars' });
    }
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 RETURNING id, email`,
      [hash, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    // Invalidate all sessions
    await query(`DELETE FROM user_sessions WHERE user_id=$1`, [id]);
    await auditLog(req.user.id, 'PASSWORD_RESET', 'users', id, null, null, req.ip);
    res.json({ message: 'Password reset. All sessions invalidated.' });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await query(`DELETE FROM user_sessions WHERE user_id=$1`, [id]);
    const { rows } = await query(`DELETE FROM users WHERE id=$1 RETURNING id, email`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await auditLog(req.user.id, 'USER_DELETE', 'users', id, { email: rows[0].email }, null, req.ip);
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
};

// ─── Server Nodes ─────────────────────────────────────────────
exports.getNodes = async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM server_nodes ORDER BY node_type, name`);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.updateNode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_online, cpu_load_pct, memory_used_pct, disk_used_pct } = req.body;
    const { rows } = await query(`
      UPDATE server_nodes SET
        is_online        = COALESCE($1, is_online),
        cpu_load_pct     = COALESCE($2, cpu_load_pct),
        memory_used_pct  = COALESCE($3, memory_used_pct),
        disk_used_pct    = COALESCE($4, disk_used_pct),
        last_heartbeat   = NOW()
      WHERE id=$5 RETURNING *
    `, [is_online, cpu_load_pct, memory_used_pct, disk_used_pct, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Node not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// ─── Override Protocols ───────────────────────────────────────
exports.getOverrides = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT o.*, u.full_name AS activated_by_name
      FROM override_protocols o
      LEFT JOIN users u ON u.id = o.activated_by
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createOverride = async (req, res, next) => {
  try {
    const { name, description, scope, target_id, payload } = req.body;
    const { rows } = await query(`
      INSERT INTO override_protocols (name, description, scope, target_id, payload, is_active, activated_by, activated_at)
      VALUES ($1,$2,$3,$4,$5,TRUE,$6,NOW()) RETURNING *
    `, [name, description, scope || 'GLOBAL', target_id || null, JSON.stringify(payload || {}), req.user.id]);
    await auditLog(req.user.id, 'OVERRIDE_ACTIVATE', 'override_protocols', rows[0].id, null, rows[0], req.ip);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.deactivateOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      UPDATE override_protocols SET is_active=FALSE, deactivated_at=NOW() WHERE id=$1 RETURNING *
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Override not found' });
    await auditLog(req.user.id, 'OVERRIDE_DEACTIVATE', 'override_protocols', id, null, null, req.ip);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// ─── Audit Logs ───────────────────────────────────────────────
exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '200'), 500);
    const offset = parseInt(req.query.offset || '0');
    const { action, resource_type, user_id } = req.query;

    let sql = `
      SELECT al.*, u.full_name, u.role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params = [];
    if (action)        { params.push(action);        sql += ` AND al.action ILIKE $${params.length}`; }
    if (resource_type) { params.push(resource_type); sql += ` AND al.resource_type = $${params.length}`; }
    if (user_id)       { params.push(user_id);       sql += ` AND al.user_id = $${params.length}`; }
    params.push(limit, offset);
    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`;

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
};

// ─── System stats ─────────────────────────────────────────────
exports.getSystemStats = async (req, res, next) => {
  try {
    const [users, vessels, telemetryCount, routes, alerts] = await Promise.all([
      query(`SELECT role, COUNT(*) AS count FROM users GROUP BY role`),
      query(`SELECT type, status, COUNT(*) AS count FROM vessels GROUP BY type, status`),
      query(`SELECT COUNT(*) AS count FROM telemetry WHERE time > NOW() - INTERVAL '1 hour'`),
      query(`SELECT status, COUNT(*) AS count FROM routes GROUP BY status`),
      query(`SELECT severity, COUNT(*) AS count FROM alerts WHERE is_acknowledged=FALSE GROUP BY severity`),
    ]);
    res.json({
      users:          users.rows,
      vessels:        vessels.rows,
      telemetry_1h:   parseInt(telemetryCount.rows[0].count),
      routes:         routes.rows,
      active_alerts:  alerts.rows,
      uptime_s:       Math.round(process.uptime()),
      memory_mb:      Math.round(process.memoryUsage().rss / 1024 / 1024),
      node_version:   process.version,
    });
  } catch (err) { next(err); }
};
