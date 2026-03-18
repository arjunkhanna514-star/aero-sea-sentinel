// src/tests/telemetry.test.js
jest.mock('../db/pool', () => ({
  query: jest.fn(),
  pool:  { end: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [] }) },
}));
jest.mock('../services/alertService', () => ({ startAlertService: jest.fn(() => jest.fn()) }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../middleware/logger', () => ({ logger: { info:jest.fn(), warn:jest.fn(), error:jest.fn(), debug:jest.fn() }, requestLogger: (req,res,next) => next() }));
jest.mock('../services/metrics',        () => ({ metricsMiddleware: (r,rs,n)=>n(), generateMetrics: jest.fn().mockResolvedValue(''), increment: jest.fn(), recordDuration: jest.fn() }));
jest.mock('../websocket/telemetryBroadcaster', () => ({ createWsServer: jest.fn(() => ({ clients: new Set() })), broadcastEvent: jest.fn() }));

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { app } = require('../index');
const { query } = require('../db/pool');

process.env.JWT_SECRET = 'test_secret_for_jest_only';

// Helper: make a signed JWT + inject a valid session check mock
function makeToken(role = 'ADMIN') {
  const tokenHash = 'testhash_' + role;
  const token = jwt.sign({ userId: 'u-001', role, tokenHash }, 'test_secret_for_jest_only', { expiresIn: '1h' });
  return { token, tokenHash };
}

function mockAuthSession(role = 'ADMIN') {
  const { token, tokenHash } = makeToken(role);
  query.mockResolvedValueOnce({
    rows: [{ id: 'u-001', email: 'test@sentinel.io', full_name: 'Test User', role, is_active: true }],
  });
  return token;
}

const MOCK_TELEMETRY = [
  {
    vessel_id: 'v-001', time: new Date().toISOString(),
    latitude: 35.8, longitude: -140.2, speed_knots: 18.4,
    fuel_level_pct: 62.4, fuel_burn_rate_lph: 4820,
    drag_reduction_pct: 17.2, drag_coefficient: 0.000842,
    quantum_temp_celsius: 3.72, quantum_coherence_pct: 99.2,
    lidar_range_m: 12400, co2_kg_per_hour: 22.4,
    vessel_name: 'MV Pacific Sentinel', callsign: 'MVPS-01',
    vessel_type: 'SHIP', vessel_status: 'ACTIVE',
  },
];

describe('GET /api/v1/telemetry/live', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/telemetry/live');
    expect(res.status).toBe(401);
  });

  it('returns live telemetry array for authenticated user', async () => {
    const token = mockAuthSession('OPERATOR');
    query.mockResolvedValueOnce({ rows: MOCK_TELEMETRY });

    const res = await request(app)
      .get('/api/v1/telemetry/live')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/v1/telemetry/fleet/summary', () => {
  it('returns fleet summary for any authenticated role', async () => {
    const token = mockAuthSession('ANALYST');
    query.mockResolvedValueOnce({
      rows: [{
        active_vessels: '4',
        avg_drag_reduction_pct: '16.80',
        avg_quantum_coherence: '99.10',
        total_fuel_burn_lph: '18240.00',
        total_fuel_saved_today_l: '5821.20',
        total_co2_per_hour: '89.40',
        avg_speed_knots: '17.2',
      }],
    });

    const res = await request(app)
      .get('/api/v1/telemetry/fleet/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('avg_drag_reduction_pct');
    expect(res.body).toHaveProperty('active_vessels');
  });
});

describe('GET /api/v1/telemetry/:vesselId/latest', () => {
  it('returns 404 for unknown vessel', async () => {
    const token = mockAuthSession('OPERATOR');
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/v1/telemetry/non-existent-id/latest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns vessel telemetry', async () => {
    const token = mockAuthSession('OPERATOR');
    query.mockResolvedValueOnce({ rows: [{ ...MOCK_TELEMETRY[0], name: 'MV Pacific Sentinel' }] });

    const res = await request(app)
      .get('/api/v1/telemetry/v-001/latest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.speed_knots).toBe(18.4);
  });
});

describe('POST /api/v1/telemetry — role gate', () => {
  it('allows ADMIN to ingest telemetry', async () => {
    const token = mockAuthSession('ADMIN');
    query.mockResolvedValueOnce({ rows: [] }); // insert OK

    const payload = { vessel_id: 'v-001', latitude: 35.8, longitude: -140.2, speed_knots: 18.4, fuel_level_pct: 62.4, fuel_burn_rate_lph: 4820, drag_reduction_pct: 17.2, drag_coefficient: 0.000842, quantum_temp_celsius: 3.72, quantum_cpu_load_pct: 68.4, quantum_coherence_pct: 99.2, lidar_range_m: 12400, lidar_visibility_pct: 94.8, wind_speed_ms: 12.4, wind_direction_deg: 240, wave_height_m: 1.8, co2_kg_per_hour: 22.4 };

    const res = await request(app)
      .post('/api/v1/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(201);
  });

  it('blocks OPERATOR from ingesting raw telemetry', async () => {
    const token = mockAuthSession('OPERATOR');
    const res = await request(app)
      .post('/api/v1/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .send({ vessel_id: 'v-001' });
    expect(res.status).toBe(403);
  });
});
