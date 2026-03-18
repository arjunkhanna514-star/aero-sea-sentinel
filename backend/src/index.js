// src/index.js — Aero-Sea Sentinel Backend Entry Point
require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const { logger, requestLogger } = require('./middleware/logger');
const rateLimit   = require('express-rate-limit');

const routes     = require('./routes/index');
const { createWsServer }   = require('./websocket/telemetryBroadcaster');
const { pool }             = require('./db/pool');
const { metricsMiddleware, generateMetrics } = require('./services/metrics');
const { startAlertService }                  = require('./services/alertService');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;

// ─── Security ───────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

// ─── Core middleware ─────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(metricsMiddleware);

// ─── Rate limiting ────────────────────────────────────────────
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// ─── Health check ────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch (_) {}
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'aero-sea-sentinel-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    db: dbOk ? 'connected' : 'unreachable',
  });
});

// ─── Prometheus metrics ───────────────────────────────────────
app.get('/metrics', async (req, res) => {
  const metrics = await generateMetrics();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});

// ─── API routes ───────────────────────────────────────────────
const PREFIX = process.env.API_PREFIX || '/api/v1';
app.use(PREFIX, routes);

// AI service proxy (streams from Python/Ollama)
const { createAIProxy } = require('./services/aiProxy');
createAIProxy(app, PREFIX);

// ─── Error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ─── WebSocket ────────────────────────────────────────────────
const wss = createWsServer(server);
global._wss = wss;

// ─── Background services ──────────────────────────────────────
const stopAlerts = startAlertService();

// ─── Graceful shutdown ────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n[${signal}] Shutting down...`);
  stopAlerts();
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (r) => console.error('[UNHANDLED]', r));

// ─── Start ────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🛸  AERO-SEA SENTINEL BACKEND  ONLINE      ║
║   REST API  → http://localhost:${PORT}${PREFIX}  ║
║   WebSocket → ws://localhost:${PORT}/ws/telemetry ║
╚══════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
