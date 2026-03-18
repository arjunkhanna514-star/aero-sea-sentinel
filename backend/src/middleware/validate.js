// src/middleware/validate.js
// Centralized request validation schemas for every endpoint
const { body, param, query, validationResult } = require('express-validator');

// ─── Helper: run validators and return 400 on failure ────────
const validate = (validators) => async (req, res, next) => {
  await Promise.all(validators.map(v => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error:  'Validation failed',
      fields: errors.array().map(e => ({ field: e.path, msg: e.msg })),
    });
  }
  next();
};

// ─── Auth schemas ─────────────────────────────────────────────
const loginSchema = validate([
  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password min 8 chars')
    .notEmpty().withMessage('Password required'),
]);

// ─── Telemetry schemas ────────────────────────────────────────
const telemetryIngestSchema = validate([
  body('vessel_id')
    .isUUID().withMessage('vessel_id must be a UUID'),
  body('latitude')
    .isFloat({ min: -90,  max: 90  }).withMessage('latitude -90..90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('longitude -180..180'),
  body('speed_knots')
    .isFloat({ min: 0, max: 600 }).withMessage('speed_knots 0..600'),
  body('fuel_level_pct')
    .isFloat({ min: 0, max: 100 }).withMessage('fuel_level_pct 0..100'),
  body('fuel_burn_rate_lph')
    .isFloat({ min: 0 }).withMessage('fuel_burn_rate_lph >= 0'),
]);

const historyQuerySchema = validate([
  param('vesselId').isUUID().withMessage('vesselId must be UUID'),
  query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('hours 1..168'),
]);

// ─── Route schemas ────────────────────────────────────────────
const createRouteSchema = validate([
  body('vessel_id')
    .isUUID().withMessage('vessel_id must be UUID'),
  body('name')
    .isLength({ min: 2, max: 255 }).withMessage('name 2..255 chars')
    .trim(),
  body('origin')
    .isLength({ min: 2, max: 255 }).withMessage('origin 2..255 chars')
    .trim(),
  body('destination')
    .isLength({ min: 2, max: 255 }).withMessage('destination 2..255 chars')
    .trim(),
  body('waypoints')
    .optional().isArray().withMessage('waypoints must be array'),
  body('is_quantum_swarm')
    .optional().isBoolean(),
  body('swarm_confidence')
    .optional().isFloat({ min: 0, max: 100 }),
  body('estimated_fuel_cost_eur')
    .optional().isFloat({ min: 0 }),
]);

const updateRouteStatusSchema = validate([
  param('id').isUUID().withMessage('id must be UUID'),
  body('status')
    .isIn(['APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED'])
    .withMessage('status must be APPROVED|REJECTED|ACTIVE|COMPLETED'),
  body('rejection_note')
    .optional().isLength({ max: 1000 }).trim(),
]);

const createSwarmRequestSchema = validate([
  body('route_id').isUUID(),
  body('vessel_id').isUUID(),
  body('proposed_waypoints').isArray().withMessage('proposed_waypoints must be array'),
  body('swarm_rationale').isLength({ min: 10, max: 2000 }).trim(),
  body('fuel_delta_eur').optional().isFloat(),
  body('time_delta_min').optional().isFloat(),
]);

// ─── AI schemas ───────────────────────────────────────────────
const aiChatSchema = validate([
  body('message')
    .isLength({ min: 1, max: 4000 }).withMessage('message 1..4000 chars')
    .trim(),
  body('session_id')
    .optional().isUUID(),
]);

// ─── User schemas (admin) ─────────────────────────────────────
const createUserSchema = validate([
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 10 }).withMessage('Password min 10 chars'),
  body('full_name').isLength({ min: 2, max: 255 }).trim(),
  body('role')
    .isIn(['ADMIN','FLEET_MANAGER','ANALYST','SENIOR_OPERATOR','OPERATOR'])
    .withMessage('Invalid role'),
]);

module.exports = {
  validate,
  loginSchema,
  telemetryIngestSchema,
  historyQuerySchema,
  createRouteSchema,
  updateRouteStatusSchema,
  createSwarmRequestSchema,
  aiChatSchema,
  createUserSchema,
};
