// src/routes/index.js — Complete API route definitions
const express = require('express');
const router  = express.Router();

const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');
const {
  loginSchema, telemetryIngestSchema, historyQuerySchema,
  createRouteSchema, updateRouteStatusSchema, createSwarmRequestSchema,
  createUserSchema,
} = require('../middleware/validate');

const authCtrl   = require('../controllers/authController');
const telCtrl    = require('../controllers/telemetryController');
const finCtrl    = require('../controllers/financialsController');
const routeCtrl  = require('../controllers/routesController');
const vesselCtrl = require('../controllers/vesselsController');
const alertsCtrl = require('../controllers/alertsController');
const adminCtrl  = require('../controllers/adminController');

// ─── AUTH
router.post('/auth/login',  loginSchema, authCtrl.login);
router.post('/auth/logout', authenticate, authCtrl.logout);
router.get ('/auth/me',     authenticate, authCtrl.me);

// ─── TELEMETRY
router.get ('/telemetry/live',              authenticate, telCtrl.getLive);
router.get ('/telemetry/fleet/summary',     authenticate, telCtrl.getFleetSummary);
router.get ('/telemetry/:vesselId/latest',  authenticate, telCtrl.getLatestForVessel);
router.get ('/telemetry/:vesselId/history', authenticate, historyQuerySchema, telCtrl.getHistory);
router.post('/telemetry', authenticate, requireRole('ADMIN'), telemetryIngestSchema, telCtrl.ingest);

// ─── FINANCIALS
router.get('/financials/kpis',        authenticate, finCtrl.getFleetKPIs);
router.get('/financials/savings',     authenticate, finCtrl.getSavingsSummary);
router.get('/financials/projections', authenticate, requireRole('ADMIN','FLEET_MANAGER','ANALYST'), finCtrl.getProjections);
router.get('/financials/drag',        authenticate, finCtrl.getDragEfficiency);
router.get('/financials/case-studies',authenticate, finCtrl.getCaseStudies);

// ─── VESSELS
router.get  ('/vessels',              authenticate, vesselCtrl.getAll);
router.get  ('/vessels/:id',          authenticate, vesselCtrl.getById);
router.get  ('/vessels/:id/telemetry',authenticate, vesselCtrl.getTelemetrySummary);
router.post ('/vessels',  authenticate, requireRole('ADMIN','FLEET_MANAGER'), vesselCtrl.create);
router.patch('/vessels/:id', authenticate, requireMinRole('FLEET_MANAGER'), vesselCtrl.update);

// ─── ROUTES
router.get  ('/routes',     authenticate, routeCtrl.getAll);
router.get  ('/routes/:id', authenticate, routeCtrl.getById);
router.post ('/routes', authenticate, requireMinRole('OPERATOR'), createRouteSchema, routeCtrl.create);
router.patch('/routes/:id/status', authenticate, requireMinRole('SENIOR_OPERATOR'), updateRouteStatusSchema, routeCtrl.updateStatus);
router.post ('/routes/swarm-requests',            authenticate, requireMinRole('OPERATOR'),              createSwarmRequestSchema, routeCtrl.createSwarmRequest);
router.patch('/routes/swarm-requests/:id/review', authenticate, requireRole('SENIOR_OPERATOR','ADMIN'), routeCtrl.reviewSwarmRequest);

// ─── ALERTS
router.get  ('/alerts',                    authenticate, alertsCtrl.getAll);
router.get  ('/alerts/stats',              authenticate, alertsCtrl.getStats);
router.get  ('/alerts/:id',                authenticate, alertsCtrl.getById);
router.post ('/alerts',                    authenticate, requireMinRole('SENIOR_OPERATOR'), alertsCtrl.create);
router.patch('/alerts/acknowledge-all',    authenticate, alertsCtrl.acknowledgeAll);
router.patch('/alerts/:id/acknowledge',    authenticate, alertsCtrl.acknowledge);

// ─── ADMIN
router.get   ('/admin/stats',                         authenticate, requireRole('ADMIN'), adminCtrl.getSystemStats);
router.get   ('/admin/users',                         authenticate, requireRole('ADMIN'), adminCtrl.getUsers);
router.post  ('/admin/users',                         authenticate, requireRole('ADMIN'), createUserSchema, adminCtrl.createUser);
router.patch ('/admin/users/:id',                     authenticate, requireRole('ADMIN'), adminCtrl.updateUser);
router.post  ('/admin/users/:id/reset-password',      authenticate, requireRole('ADMIN'), adminCtrl.resetPassword);
router.delete('/admin/users/:id',                     authenticate, requireRole('ADMIN'), adminCtrl.deleteUser);
router.get   ('/admin/server-nodes',                  authenticate, requireRole('ADMIN'), adminCtrl.getNodes);
router.patch ('/admin/server-nodes/:id',              authenticate, requireRole('ADMIN'), adminCtrl.updateNode);
router.get   ('/admin/overrides',                     authenticate, requireRole('ADMIN'), adminCtrl.getOverrides);
router.post  ('/admin/overrides',                     authenticate, requireRole('ADMIN'), adminCtrl.createOverride);
router.patch ('/admin/overrides/:id/deactivate',      authenticate, requireRole('ADMIN'), adminCtrl.deactivateOverride);
router.get   ('/admin/audit-logs',                    authenticate, requireRole('ADMIN'), adminCtrl.getAuditLogs);

module.exports = router;
