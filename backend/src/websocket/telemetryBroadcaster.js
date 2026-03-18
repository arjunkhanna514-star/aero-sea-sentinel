// src/websocket/telemetryBroadcaster.js
// Sub-second live telemetry via WebSockets
const WebSocket = require('ws');
const { query }  = require('../db/pool');

const BROADCAST_INTERVAL_MS = parseInt(process.env.TELEMETRY_BROADCAST_MS || '1000');
const HEARTBEAT_MS           = parseInt(process.env.WS_HEARTBEAT_MS || '30000');

// Client metadata map: ws → { userId, role, subscriptions: Set<vesselId|'all'> }
const clients = new Map();

function createWsServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/telemetry' });

  wss.on('connection', (ws, req) => {
    // Quick token auth via query param: ?token=<jwt>
    const url    = new URL(req.url, `http://${req.headers.host}`);
    const token  = url.searchParams.get('token');
    const userId = verifyToken(token);
    if (!userId) {
      ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid token' }));
      ws.terminate();
      return;
    }

    clients.set(ws, { userId, subscriptions: new Set(['all']) });
    ws.isAlive = true;

    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Sentinel telemetry stream active', interval_ms: BROADCAST_INTERVAL_MS }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(ws, msg);
      } catch (_) {}
    });

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  // Heartbeat to detect dead connections
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_MS);

  // 1-second telemetry broadcast loop
  const broadcastTimer = setInterval(async () => {
    if (wss.clients.size === 0) return;
    try {
      const telemetry = await fetchLatestTelemetry();
      const alerts    = await fetchRecentAlerts();
      const kpis      = await fetchFleetKPIs();

      const payload = JSON.stringify({
        type:      'TELEMETRY_UPDATE',
        timestamp: new Date().toISOString(),
        telemetry,
        alerts,
        kpis,
      });

      wss.clients.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const meta = clients.get(ws);
        if (!meta) return;
        // Role-based filtering: OPERATOR only gets their vessel
        // (simplified: in production, attach vessel_id to session)
        ws.send(payload);
      });
    } catch (err) {
      console.error('[WS] Broadcast error:', err.message);
    }
  }, BROADCAST_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
    clearInterval(broadcastTimer);
  });

  console.log(`[WS] Telemetry broadcaster ready — ${BROADCAST_INTERVAL_MS}ms interval`);
  return wss;
}

function handleClientMessage(ws, msg) {
  const meta = clients.get(ws);
  if (!meta) return;

  switch (msg.type) {
    case 'SUBSCRIBE_VESSEL':
      meta.subscriptions.add(msg.vesselId);
      ws.send(JSON.stringify({ type: 'SUBSCRIBED', vesselId: msg.vesselId }));
      break;
    case 'UNSUBSCRIBE_VESSEL':
      meta.subscriptions.delete(msg.vesselId);
      break;
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
      break;
  }
}

async function fetchLatestTelemetry() {
  const { rows } = await query(`
    SELECT DISTINCT ON (t.vessel_id)
      t.vessel_id, t.time,
      t.latitude, t.longitude, t.altitude_m, t.heading_deg, t.speed_knots,
      t.fuel_level_pct, t.fuel_burn_rate_lph, t.fuel_saved_l,
      t.drag_coefficient, t.drag_reduction_pct,
      t.smart_skin_active_zones, t.micro_adjustment_count,
      t.quantum_temp_celsius, t.quantum_cpu_load_pct, t.quantum_coherence_pct,
      t.lidar_range_m, t.lidar_object_count, t.lidar_visibility_pct,
      t.wind_speed_ms, t.jet_stream_velocity_ms, t.wave_height_m,
      t.co2_kg_per_hour,
      v.name, v.callsign, v.type, v.status
    FROM telemetry t
    JOIN vessels v ON v.id = t.vessel_id
    WHERE v.status = 'ACTIVE'
    ORDER BY t.vessel_id, t.time DESC
  `);
  return rows;
}

async function fetchRecentAlerts() {
  const { rows } = await query(`
    SELECT id, vessel_id, severity, category, title, created_at
    FROM alerts
    WHERE is_acknowledged = FALSE
      AND created_at > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC LIMIT 10
  `);
  return rows;
}

async function fetchFleetKPIs() {
  const { rows } = await query(`SELECT * FROM fleet_kpis ORDER BY recorded_at DESC LIMIT 1`);
  return rows[0] || {};
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (_) {
    return null;
  }
}

// Broadcast a specific event to all connected clients (called from controllers)
function broadcastEvent(type, payload) {
  // This function is exported so controllers can push events (e.g. route approved)
  // In production use Redis pub/sub for multi-process
  if (!global._wss) return;
  const msg = JSON.stringify({ type, ...payload, timestamp: new Date().toISOString() });
  global._wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

module.exports = { createWsServer, broadcastEvent };
