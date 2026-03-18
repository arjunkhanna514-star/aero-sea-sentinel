// simulator/simulator.js
// ============================================================
// AERO-SEA SENTINEL — Realistic Telemetry Simulator
// Generates physics-based telemetry for 5 vessels (3 ships + 2 aircraft)
// Sends to backend REST API every 1 second
// ============================================================

const API_URL    = process.env.API_URL    || 'http://localhost:4000/api/v1';
const EMAIL      = process.env.ADMIN_EMAIL    || 'admin@sentinel.io';
const PASSWORD   = process.env.ADMIN_PASSWORD || 'Sentinel2025!';
const INTERVAL   = parseInt(process.env.SIM_INTERVAL_MS || '1000');

// ─── Vessel definitions ─────────────────────────────────────
const VESSELS = [
  {
    id: null, // filled after API call
    callsign: 'MVPS-01',
    type: 'SHIP',
    route: { lat: 35.8, lon: -140.2, destLat: 33.7, destLon: -118.2, heading: 285 },
    state: {
      speed: 18.4, fuelLevel: 62.4, fuelCapacity: 6500000,
      dragCoeff: 0.000842, dragReduction: 17.2,
      smartSkinZones: 1840, totalPanels: 2400,
      quantumTemp: 3.72, quantumCPU: 68.4, quantumCoherence: 99.2,
      lidarRange: 12400, lidarVisibility: 94.8,
      windSpeed: 12.4, windDir: 240, waveHeight: 1.8,
      co2Rate: 22.4,
    }
  },
  {
    id: null,
    callsign: 'MVAG-02',
    type: 'SHIP',
    route: { lat: 42.1, lon: -32.4, destLat: 51.5, destLon: -0.1, heading: 058 },
    state: {
      speed: 15.1, fuelLevel: 78.1, fuelCapacity: 5800000,
      dragCoeff: 0.000918, dragReduction: 15.8,
      smartSkinZones: 1680, totalPanels: 2100,
      quantumTemp: 3.81, quantumCPU: 61.2, quantumCoherence: 98.7,
      lidarRange: 11200, lidarVisibility: 88.4,
      windSpeed: 18.2, windDir: 210, waveHeight: 2.4,
      co2Rate: 18.8,
    }
  },
  {
    id: null,
    callsign: 'ASHE-01',
    type: 'AIRCRAFT',
    route: { lat: 51.2, lon: 12.4, destLat: 40.7, destLon: -74.0, heading: 290, altitude: 11280 },
    state: {
      speed: 478, fuelLevel: 54.2, fuelCapacity: 185000,
      dragCoeff: 0.0248, dragReduction: 18.4,
      smartSkinZones: 680, totalPanels: 840,
      quantumTemp: 3.65, quantumCPU: 74.8, quantumCoherence: 99.6,
      lidarRange: 45000, lidarVisibility: 97.2,
      windSpeed: 28.4, windDir: 270, waveHeight: 0,
      jetStreamVelocity: 62.4,
      co2Rate: 8.4,
    }
  },
  {
    id: null,
    callsign: 'ASQF-02',
    type: 'AIRCRAFT',
    route: { lat: 35.7, lon: 139.7, destLat: 1.4, destLon: 103.8, heading: 195, altitude: 10680 },
    state: {
      speed: 452, fuelLevel: 81.0, fuelCapacity: 172000,
      dragCoeff: 0.0262, dragReduction: 0,
      smartSkinZones: 0, totalPanels: 0,
      quantumTemp: null, quantumCPU: null, quantumCoherence: null,
      lidarRange: 38000, lidarVisibility: 92.1,
      windSpeed: 14.2, windDir: 180, waveHeight: 0,
      jetStreamVelocity: 22.8,
      co2Rate: 9.2,
    }
  },
  {
    id: null,
    callsign: 'MVSE-03',
    type: 'SHIP',
    route: { lat: 24.4, lon: 155.8, destLat: 33.7, destLon: -118.2, heading: 065 },
    state: {
      speed: 21.2, fuelLevel: 44.8, fuelCapacity: 7200000,
      dragCoeff: 0.000798, dragReduction: 17.0,
      smartSkinZones: 1880, totalPanels: 1980,
      quantumTemp: 3.69, quantumCPU: 71.4, quantumCoherence: 99.4,
      lidarRange: 13800, lidarVisibility: 96.2,
      windSpeed: 8.6, windDir: 120, waveHeight: 1.2,
      co2Rate: 26.8,
    }
  },
];

// ─── Physics simulation helpers ──────────────────────────────
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand  = (min, max) => min + Math.random() * (max - min);
const jitter = (v, pct) => v * (1 + (Math.random() - 0.5) * 2 * pct);

function simulateTick(vessel) {
  const s = vessel.state;
  const isAir = vessel.type === 'AIRCRAFT';

  // Speed variation
  s.speed = clamp(
    s.speed + rand(-0.3, 0.3) * (isAir ? 8 : 0.5),
    isAir ? 400 : 8, isAir ? 550 : 28
  );

  // Fuel consumption model (drag reduction saves fuel)
  const baseBurnLPH = isAir ? 8200 : 4800;
  const dragFactor  = 1 - (s.dragReduction / 100) * 0.18;
  const speedFactor = (s.speed / (isAir ? 480 : 18)) ** 2.8;
  const burnRate    = baseBurnLPH * dragFactor * speedFactor * jitter(1, 0.02);
  const burnPerTick = burnRate / 3600;
  s.fuelLevel = clamp(s.fuelLevel - (burnPerTick / s.fuelCapacity) * 100, 0, 100);
  const fuelSavedL = (baseBurnLPH - burnRate) / 3600;

  // Smart Skin micro-adjustments
  if (s.totalPanels > 0) {
    s.dragCoeff    = clamp(s.dragCoeff + rand(-0.000002, 0.000002), 0.00070, 0.00100);
    s.dragReduction = clamp(s.dragReduction + rand(-0.08, 0.10), 12.0, 22.0);
    s.smartSkinZones = Math.round(s.totalPanels * (0.72 + rand(0, 0.18)));
  }

  // Quantum processor
  if (s.quantumTemp !== null) {
    s.quantumTemp       = clamp(s.quantumTemp + rand(-0.02, 0.02), 3.2, 4.5);
    s.quantumCPU        = clamp(s.quantumCPU + rand(-1.5, 1.5), 45, 95);
    s.quantumCoherence  = clamp(s.quantumCoherence + rand(-0.05, 0.03), 96.0, 99.9);
  }

  // Eagle Eye LiDAR
  s.lidarRange      = clamp(s.lidarRange + rand(-200, 200), 5000, 50000);
  s.lidarVisibility = clamp(s.lidarVisibility + rand(-0.3, 0.2), 60, 100);
  const lidarObjects = Math.random() < 0.02 ? Math.floor(rand(0, 5)) : 
                       (Math.random() < 0.95 ? Math.floor(rand(0, 3)) : undefined);

  // Weather
  s.windSpeed    = clamp(s.windSpeed + rand(-0.4, 0.4), 0, 50);
  s.windDir      = (s.windDir + rand(-2, 2) + 360) % 360;
  s.waveHeight   = clamp(s.waveHeight + rand(-0.05, 0.05), 0, 8);
  if (isAir && s.jetStreamVelocity !== undefined) {
    s.jetStreamVelocity = clamp(s.jetStreamVelocity + rand(-1, 1), 0, 120);
  }

  // CO2 correlated with burn rate
  s.co2Rate = clamp(burnRate * 0.0028 + rand(-0.2, 0.2), 2, 40);

  // Position drift (simple movement)
  const r   = vessel.route;
  const dlat = Math.cos(r.heading * Math.PI / 180) * s.speed * 0.0003;
  const dlon = Math.sin(r.heading * Math.PI / 180) * s.speed * 0.0004;
  r.lat = r.lat + dlat * (rand(0.9, 1.1));
  r.lon = r.lon + dlon * (rand(0.9, 1.1));

  return {
    vessel_id:               vessel.id,
    latitude:                +r.lat.toFixed(6),
    longitude:               +r.lon.toFixed(6),
    altitude_m:              r.altitude || null,
    heading_deg:             +((r.heading + rand(-0.5, 0.5)) % 360).toFixed(2),
    speed_knots:             +s.speed.toFixed(2),
    fuel_level_pct:          +s.fuelLevel.toFixed(3),
    fuel_burn_rate_lph:      +burnRate.toFixed(2),
    fuel_saved_l:            +fuelSavedL.toFixed(4),
    drag_coefficient:        +s.dragCoeff.toFixed(8),
    drag_reduction_pct:      +s.dragReduction.toFixed(3),
    smart_skin_active_zones: s.smartSkinZones,
    micro_adjustment_count:  Math.floor(rand(2, 8)),
    quantum_temp_celsius:    s.quantumTemp   !== null ? +s.quantumTemp.toFixed(3)      : null,
    quantum_cpu_load_pct:    s.quantumCPU    !== null ? +s.quantumCPU.toFixed(2)       : null,
    quantum_coherence_pct:   s.quantumCoherence !== null ? +s.quantumCoherence.toFixed(3) : null,
    lidar_range_m:           +s.lidarRange.toFixed(1),
    lidar_object_count:      lidarObjects !== undefined ? lidarObjects : Math.floor(rand(0, 3)),
    lidar_visibility_pct:    +s.lidarVisibility.toFixed(2),
    wind_speed_ms:           +s.windSpeed.toFixed(2),
    wind_direction_deg:      +s.windDir.toFixed(1),
    wave_height_m:           +s.waveHeight.toFixed(3),
    jet_stream_velocity_ms:  s.jetStreamVelocity !== undefined ? +s.jetStreamVelocity.toFixed(2) : null,
    sea_temp_celsius:        isAir ? null : +(15 + rand(-3, 3)).toFixed(2),
    air_temp_celsius:        +(12 + rand(-5, 5)).toFixed(2),
    co2_kg_per_hour:         +s.co2Rate.toFixed(3),
    nox_g_per_hour:          +(burnRate * 0.00048).toFixed(3),
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────
let authToken = null;

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  authToken = data.token;
  console.log(`[SIM] Authenticated as ${EMAIL}`);
}

async function fetchVessels() {
  const res = await fetch(`${API_URL}/vessels`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`Vessels fetch failed: ${res.status}`);
  return res.json();
}

async function sendTelemetry(payload) {
  const res = await fetch(`${API_URL}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 401) { authToken = null; return; }
    console.error(`[SIM] Telemetry error ${res.status}: ${txt}`);
  }
}

// ─── Main loop ────────────────────────────────────────────────
async function init() {
  // Retry login loop
  while (!authToken) {
    try { await login(); }
    catch (err) {
      console.warn(`[SIM] Login failed (${err.message}), retrying in 5s...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Map callsigns to vessel IDs
  try {
    const apiVessels = await fetchVessels();
    for (const simVessel of VESSELS) {
      const match = apiVessels.find(v => v.callsign === simVessel.callsign);
      if (match) {
        simVessel.id = match.id;
        console.log(`[SIM] Mapped ${simVessel.callsign} → ${match.id}`);
      } else {
        console.warn(`[SIM] No vessel found for callsign ${simVessel.callsign}`);
      }
    }
  } catch (err) {
    console.error('[SIM] Failed to fetch vessels:', err.message);
  }

  console.log(`[SIM] Starting telemetry loop (${INTERVAL}ms interval, ${VESSELS.length} vessels)`);

  let tick = 0;
  setInterval(async () => {
    if (!authToken) { await login().catch(() => {}); return; }

    tick++;
    const promises = VESSELS
      .filter(v => v.id)
      .map(vessel => {
        const payload = simulateTick(vessel);
        return sendTelemetry(payload);
      });

    await Promise.allSettled(promises);

    if (tick % 60 === 0) {
      const active = VESSELS.filter(v => v.id).length;
      console.log(`[SIM] tick=${tick} | vessels=${active} | ${new Date().toISOString()}`);
    }
  }, INTERVAL);
}

// Graceful shutdown
process.on('SIGTERM', () => { console.log('[SIM] Shutting down...'); process.exit(0); });
process.on('SIGINT',  () => { console.log('[SIM] Shutting down...'); process.exit(0); });

init().catch(err => {
  console.error('[SIM] Fatal error:', err);
  process.exit(1);
});
