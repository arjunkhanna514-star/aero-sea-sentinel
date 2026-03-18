// src/services/alertService.js
// Watches telemetry stream and auto-creates alerts when thresholds are breached
// Runs as a background cron inside the backend process

const { query }  = require('../db/pool');
const { publish, CHANNEL_ALERTS } = require('./redisPubSub');
const { broadcastEvent } = require('../websocket/telemetryBroadcaster');

// Threshold rules — each returns { triggered, severity, category, title, message }
const RULES = [
  {
    id:       'LOW_FUEL',
    category: 'FUEL',
    check: (t) => t.fuel_level_pct < 20,
    severity: 'CRITICAL',
    title: (t) => `Low Fuel — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Fuel level at ${(+t.fuel_level_pct).toFixed(1)}% — below 20% threshold. Immediate attention required.`,
  },
  {
    id:       'FUEL_WARNING',
    category: 'FUEL',
    check: (t) => t.fuel_level_pct < 30 && t.fuel_level_pct >= 20,
    severity: 'WARNING',
    title: (t) => `Fuel Warning — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Fuel level at ${(+t.fuel_level_pct).toFixed(1)}% — approaching low threshold.`,
  },
  {
    id:       'QUANTUM_TEMP_HIGH',
    category: 'QUANTUM',
    check: (t) => t.quantum_temp_celsius !== null && t.quantum_temp_celsius > 4.2,
    severity: 'WARNING',
    title: (t) => `Quantum Processor Temp — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Quantum processor temperature ${(+t.quantum_temp_celsius).toFixed(3)}°K exceeds 4.2°K nominal. Check cooling.`,
  },
  {
    id:       'QUANTUM_COHERENCE_LOW',
    category: 'QUANTUM',
    check: (t) => t.quantum_coherence_pct !== null && t.quantum_coherence_pct < 97.0,
    severity: 'CRITICAL',
    title: (t) => `Quantum Coherence Degraded — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Coherence at ${(+t.quantum_coherence_pct).toFixed(2)}%. Navigation accuracy compromised. Re-calibrate immediately.`,
  },
  {
    id:       'LIDAR_OBJECT_DETECTED',
    category: 'LIDAR',
    check: (t) => parseInt(t.lidar_object_count) >= 4,
    severity: 'WARNING',
    title: (t) => `Eagle Eye: Multiple Objects — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Eagle Eye LiDAR detecting ${t.lidar_object_count} objects within ${(+t.lidar_range_m/1000).toFixed(1)}km. Review radar.`,
  },
  {
    id:       'DRAG_DEGRADED',
    category: 'SMART_SKIN',
    check: (t) => t.drag_reduction_pct !== null && t.drag_reduction_pct < 10.0,
    severity: 'WARNING',
    title: (t) => `Smart Skin Efficiency Drop — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Drag reduction fell to ${(+t.drag_reduction_pct).toFixed(1)}%. Smart Skin micro-actuator check recommended.`,
  },
  {
    id:       'HIGH_WAVES',
    category: 'WEATHER',
    check: (t) => t.wave_height_m !== null && t.wave_height_m > 5.0,
    severity: 'WARNING',
    title: (t) => `High Sea State — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Wave height ${(+t.wave_height_m).toFixed(1)}m. Consider route adjustment via Quantum Swarm.`,
  },
  {
    id:       'LIDAR_VISIBILITY_LOW',
    category: 'LIDAR',
    check: (t) => t.lidar_visibility_pct < 50,
    severity: 'CRITICAL',
    title: (t) => `Low LiDAR Visibility — ${t.vessel_name || t.vessel_id}`,
    message: (t) => `Eagle Eye visibility at ${(+t.lidar_visibility_pct).toFixed(0)}%. Sensor degradation or severe weather.`,
  },
];

// Track recently fired alerts to debounce (vessel+rule, 5 min cooldown)
const recentAlerts = new Map();
const COOLDOWN_MS  = 5 * 60 * 1000;

async function runAlertChecks() {
  try {
    // Get latest telemetry per vessel
    const { rows } = await query(`
      SELECT DISTINCT ON (t.vessel_id)
        t.vessel_id, t.fuel_level_pct, t.fuel_burn_rate_lph,
        t.quantum_temp_celsius, t.quantum_coherence_pct,
        t.lidar_range_m, t.lidar_object_count, t.lidar_visibility_pct,
        t.drag_reduction_pct, t.wave_height_m,
        v.name AS vessel_name
      FROM telemetry t
      JOIN vessels v ON v.id = t.vessel_id
      WHERE v.status = 'ACTIVE' AND t.time > NOW() - INTERVAL '30 seconds'
      ORDER BY t.vessel_id, t.time DESC
    `);

    for (const telemetry of rows) {
      for (const rule of RULES) {
        if (!rule.check(telemetry)) continue;

        const dedupeKey = `${telemetry.vessel_id}:${rule.id}`;
        const lastFired = recentAlerts.get(dedupeKey);
        if (lastFired && Date.now() - lastFired < COOLDOWN_MS) continue;

        recentAlerts.set(dedupeKey, Date.now());

        // Persist alert to DB
        const { rows: alertRows } = await query(`
          INSERT INTO alerts (vessel_id, severity, category, title, message)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, vessel_id, severity, category, title, created_at
        `, [
          telemetry.vessel_id,
          rule.severity,
          rule.category,
          rule.title(telemetry),
          rule.message(telemetry),
        ]);

        const alert = alertRows[0];

        // Broadcast alert to all WS clients
        try {
          broadcastEvent('NEW_ALERT', {
            alert: { ...alert, vessel_name: telemetry.vessel_name },
          });
        } catch (_) {}

        // Publish to Redis for multi-process
        await publish(CHANNEL_ALERTS, { type: 'NEW_ALERT', alert });

        console.log(`[ALERT] ${rule.severity} — ${rule.title(telemetry)}`);
      }
    }
  } catch (err) {
    console.error('[AlertService] Error:', err.message);
  }
}

function startAlertService() {
  // Run every 15 seconds
  const interval = setInterval(runAlertChecks, 15000);
  // First run after 10s startup delay
  setTimeout(runAlertChecks, 10000);
  console.log('[AlertService] Started — checking every 15s');
  return () => clearInterval(interval);
}

module.exports = { startAlertService, runAlertChecks };
