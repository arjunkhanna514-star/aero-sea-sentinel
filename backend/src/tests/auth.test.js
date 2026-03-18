// src/tests/auth.test.js
const request = require('supertest');
const bcrypt  = require('bcryptjs');
const { app } = require('../index');

// Mock DB pool so tests don't need a real DB
jest.mock('../db/pool', () => ({
  query: jest.fn(),
  pool:  { end: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [] }) },
}));
jest.mock('../services/alertService', () => ({ startAlertService: jest.fn(() => jest.fn()) }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../websocket/telemetryBroadcaster', () => ({
  createWsServer: jest.fn(() => ({ clients: new Set() })),
  broadcastEvent: jest.fn(),
}));
jest.mock('../middleware/logger', () => ({ logger: { info:jest.fn(), warn:jest.fn(), error:jest.fn(), debug:jest.fn() }, requestLogger: (req,res,next) => next() }));
jest.mock('../services/metrics', () => ({
  metricsMiddleware: (req, res, next) => next(),
  generateMetrics:   jest.fn().mockResolvedValue(''),
  increment: jest.fn(),
  recordDuration: jest.fn(),
}));

const { query } = require('../db/pool');

const MOCK_USER = {
  id:            'u-001',
  email:         'admin@sentinel.io',
  password_hash: bcrypt.hashSync('Sentinel2025!', 4), // fast rounds for tests
  full_name:     'Admiral Chen Wei',
  role:          'ADMIN',
  is_active:     true,
};

describe('POST /api/v1/auth/login', () => {
  const PREFIX = '/api/v1';

  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for missing credentials', async () => {
    const res = await request(app).post(`${PREFIX}/auth/login`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // user not found
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'unknown@test.io', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid credentials/i);
  });

  it('returns 401 for wrong password', async () => {
    query.mockResolvedValueOnce({ rows: [MOCK_USER] }); // user found
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: MOCK_USER.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns token + user on valid credentials', async () => {
    // user lookup
    query.mockResolvedValueOnce({ rows: [MOCK_USER] });
    // session insert
    query.mockResolvedValueOnce({ rows: [] });
    // last_login update
    query.mockResolvedValueOnce({ rows: [] });
    // audit log
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: MOCK_USER.email, password: 'Sentinel2025!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user.email).toBe(MOCK_USER.email);
  });

  it('returns 403 for inactive user', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...MOCK_USER, is_active: false }] });
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: MOCK_USER.email, password: 'Sentinel2025!' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/auth/me', () => {
  const PREFIX = '/api/v1';

  it('returns 401 without token', async () => {
    const res = await request(app).get(`${PREFIX}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
