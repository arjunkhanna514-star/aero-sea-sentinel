// src/tests/integration.test.js
// End-to-end API flow tests — requires a running DB
// Run with: npm run test:integration (separate from unit tests)
// These tests use real DB transactions, rolled back after each test

const request = require('supertest');

// Skip integration tests unless explicitly enabled
const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeIf = RUN_INTEGRATION ? describe : describe.skip;

// These tests need: DB, Redis, real JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_secret';

let app, server;

beforeAll(async () => {
  if (!RUN_INTEGRATION) return;
  jest.mock('../services/alertService', () => ({ startAlertService: jest.fn(() => jest.fn()) }));
  jest.mock('../websocket/telemetryBroadcaster', () => ({
    createWsServer: jest.fn(() => ({ clients: new Set(), on: jest.fn() })),
    broadcastEvent: jest.fn(),
  }));
  const mod = require('../index');
  app    = mod.app;
  server = mod.server;
});

afterAll(async () => {
  if (!RUN_INTEGRATION) return;
  if (server) server.close();
  const { pool } = require('../db/pool');
  await pool.end();
});

describeIf('Integration: Full Auth + Telemetry Flow', () => {
  let adminToken;
  let operatorToken;

  describe('Authentication', () => {
    it('GET /health returns ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('Admin can login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@sentinel.io', password: 'Sentinel2025!' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.role).toBe('ADMIN');
      adminToken = res.body.token;
    });

    it('Operator can login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'operator@sentinel.io', password: 'Sentinel2025!' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('OPERATOR');
      operatorToken = res.body.token;
    });

    it('Wrong password returns 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@sentinel.io', password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('Telemetry', () => {
    it('GET /telemetry/live returns array', async () => {
      const res = await request(app)
        .get('/api/v1/telemetry/live')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /telemetry/fleet/summary returns metrics', async () => {
      const res = await request(app)
        .get('/api/v1/telemetry/fleet/summary')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('active_vessels');
    });
  });

  describe('Financials', () => {
    it('GET /financials/savings returns targets', async () => {
      const res = await request(app)
        .get('/api/v1/financials/savings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.targets.ship_annual_target_eur).toBe(500000);
      expect(res.body.targets.aircraft_annual_target_eur).toBe(1200000);
    });

    it('GET /financials/case-studies returns Shanghai-LA', async () => {
      const res = await request(app)
        .get('/api/v1/financials/case-studies')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.map(c => c.id);
      expect(ids).toContain('shanghai-la');
    });
  });

  describe('Vessels', () => {
    it('GET /vessels returns list', async () => {
      const res = await request(app)
        .get('/api/v1/vessels')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Operator cannot create vessel', async () => {
      const res = await request(app)
        .post('/api/v1/vessels')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ name:'Test', callsign:'TEST-99', type:'SHIP' });
      expect(res.status).toBe(403);
    });
  });

  describe('Alerts', () => {
    it('GET /alerts/stats returns counts', async () => {
      const res = await request(app)
        .get('/api/v1/alerts/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('unacknowledged');
    });
  });

  describe('Admin (ADMIN only)', () => {
    it('GET /admin/users returns user list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const emails = res.body.map(u => u.email);
      expect(emails).toContain('admin@sentinel.io');
    });

    it('Operator blocked from /admin/users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /admin/stats returns system info', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uptime_s');
      expect(res.body).toHaveProperty('memory_mb');
    });
  });
});
