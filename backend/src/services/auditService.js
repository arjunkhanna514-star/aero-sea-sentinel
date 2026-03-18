// src/services/auditService.js
const { query } = require('../db/pool');

const auditLog = async (userId, action, resourceType, resourceId, oldValue, newValue, ip) => {
  try {
    await query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_value, new_value, ip_address)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [
      userId,
      action,
      resourceType,
      resourceId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ip || null,
    ]);
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
};

module.exports = { auditLog };
