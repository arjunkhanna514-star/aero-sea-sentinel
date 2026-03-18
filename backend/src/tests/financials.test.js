// src/tests/financials.test.js
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

function makeToken(role) {
  const tokenHash = 'h_' + role;
  return jwt.sign({ userId: 'u-1', role, tokenHash }, 'test_secret_for_jest_only', { expiresIn: '1h' });
}
function mockSession(role) {
  const token = makeToken(role);
  query.mockResolvedValueOnce({ rows: [{ id:'u-1', email:'t@t.io', full_name:'T', role, is_active:true }] });
  return token;
}

describe('GET /api/v1/financials/kpis', () => {
  const MOCK_KPI = {
    total_vessels: 5, active_vessels: 4,
    fleet_fuel_savings_eur: '498200.00',
    fleet_co2_savings_kg: '1240000.00',
    avg_drag_reduction_pct: '16.80',
    avg_quantum_efficiency: '94.20',
    daily_ship_savings_eur: '40250.00',
    daily_aircraft_savings_eur: '102400.00',
    routes_optimised: 847,
    swarm_decisions_today: 12,
  };

  it('returns fleet KPIs', async () => {
    const token = mockSession('FLEET_MANAGER');
    query.mockResolvedValueOnce({ rows: [MOCK_KPI] });
    const res = await request(app)
      .get('/api/v1/financials/kpis')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.routes_optimised).toBe(847);
  });
});

describe('GET /api/v1/financials/savings', () => {
  it('includes targets from brief', async () => {
    const token = mockSession('ANALYST');
    query.mockResolvedValueOnce({
      rows: [{
        total_fuel_savings_eur: '498200',
        total_ship_savings_eur: '250400',
        total_aircraft_savings_eur: '247800',
        total_smart_skin_savings_eur: null,
        shanghai_la_savings_eur: '41250',
        as_of_date: new Date().toISOString(),
      }],
    });
    const res = await request(app)
      .get('/api/v1/financials/savings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.targets.ship_annual_target_eur).toBe(500000);
    expect(res.body.targets.aircraft_annual_target_eur).toBe(1200000);
  });
});

describe('GET /api/v1/financials/projections — role gate', () => {
  ['ADMIN','FLEET_MANAGER','ANALYST'].forEach(role => {
    it(`allows ${role}`, async () => {
      const token = mockSession(role);
      query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get('/api/v1/financials/projections')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  ['SENIOR_OPERATOR','OPERATOR'].forEach(role => {
    it(`blocks ${role}`, async () => {
      const token = mockSession(role);
      const res = await request(app)
        .get('/api/v1/financials/projections')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});

describe('GET /api/v1/financials/case-studies', () => {
  it('returns Shanghai-LA and Horizon Eagle case studies', async () => {
    const token = mockSession('ANALYST');
    const res = await request(app)
      .get('/api/v1/financials/case-studies')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    const ids = res.body.map(c => c.id);
    expect(ids).toContain('shanghai-la');
    expect(ids).toContain('horizon-eagle');
    const shanghai = res.body.find(c => c.id === 'shanghai-la');
    expect(shanghai.monthly_savings_eur).toBe(41250);
    const eagle = res.body.find(c => c.id === 'horizon-eagle');
    expect(eagle.annual_savings_eur).toBe(1228800);
  });
});

// ─── Routes tests ─────────────────────────────────────────────
describe('POST /api/v1/routes', () => {
  it('allows OPERATOR to create a route', async () => {
    const token = mockSession('OPERATOR');
    query.mockResolvedValueOnce({ rows: [{ id:'r-1', vessel_id:'v-1', name:'Test', status:'PENDING', created_by:'u-1', origin:'A', destination:'B', created_at: new Date() }] });
    query.mockResolvedValueOnce({ rows: [] }); // audit log
    const res = await request(app)
      .post('/api/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ vessel_id:'v-1', name:'Test Route', origin:'Shanghai', destination:'LA' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });
});

describe('PATCH /api/v1/routes/:id/status — role gates', () => {
  it('allows SENIOR_OPERATOR to approve', async () => {
    const token = mockSession('SENIOR_OPERATOR');
    query.mockResolvedValueOnce({ rows: [{ id:'r-1', status:'APPROVED' }] });
    query.mockResolvedValueOnce({ rows: [] }); // audit
    const res = await request(app)
      .patch('/api/v1/routes/r-1/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(200);
  });

  it('blocks ANALYST from approving', async () => {
    const token = mockSession('ANALYST');
    const res = await request(app)
      .patch('/api/v1/routes/r-1/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });
});
