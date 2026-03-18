// src/middleware/auth.js — JWT + RBAC middleware
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

const ROLE_HIERARCHY = {
  ADMIN:           5,
  FLEET_MANAGER:   4,
  ANALYST:         3,
  SENIOR_OPERATOR: 2,
  OPERATOR:        1,
};

/**
 * Verify JWT and attach user to req
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check session is still valid in DB
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active
       FROM users u
       JOIN user_sessions s ON s.user_id = u.id
       WHERE u.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()`,
      [decoded.userId, decoded.tokenHash]
    );

    if (!rows[0] || !rows[0].is_active) {
      return res.status(401).json({ error: 'Session expired or user inactive' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
};

/**
 * Require one of the listed roles (exact match)
 * Usage: requireRole('ADMIN', 'FLEET_MANAGER')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      required: roles,
      actual: req.user.role,
    });
  }
  next();
};

/**
 * Require minimum hierarchy level
 * Usage: requireMinRole('SENIOR_OPERATOR')
 */
const requireMinRole = (minRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
  const minLevel  = ROLE_HIERARCHY[minRole] || 0;
  if (userLevel < minLevel) {
    return res.status(403).json({
      error: 'Insufficient role level',
      required: minRole,
      actual: req.user.role,
    });
  }
  next();
};

/**
 * Check fine-grained permission from role_permissions table
 */
const requirePermission = (resource, action) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { rows } = await query(
    `SELECT 1 FROM role_permissions WHERE role=$1 AND resource=$2 AND action=$3`,
    [req.user.role, resource, action]
  );
  if (!rows[0]) {
    return res.status(403).json({ error: `No permission: ${action} on ${resource}` });
  }
  next();
};

module.exports = { authenticate, requireRole, requireMinRole, requirePermission };
