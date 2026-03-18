// src/tests/alertService.test.js
jest.mock('../db/pool', () => ({ query: jest.fn() }));
jest.mock('../services/redisPubSub', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
  CHANNEL_ALERTS: 'sentinel:alerts',
}));
jest.mock('../websocket/telemetryBroadcaster', () => ({ broadcastEvent: jest.fn() }));

const { query }           = require('../db/pool');
const { broadcastEvent }  = require('../websocket/telemetryBroadcaster');
const { publish }         = require('../services/redisPubSub');
const { runAlertChecks }  = require('../services/alertService');

// Helper to build a mock telemetry row
const mkTel = (overrides = {}) => ({
  vessel_id:           'v-001',
  vessel_name:         'MV Test Vessel',
  fuel_level_pct:      62.4,
  fuel_burn_rate_lph:  4820,
  quantum_temp_celsius: 3.72,
  quantum_coherence_pct: 99.2,
  lidar_range_m:       12400,
  lidar_object_count:  1,
  lidar_visibility_pct: 94.8,
  drag_reduction_pct:  17.2,
  wave_height_m:       1.8,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
});

describe('runAlertChecks()', () => {
  it('creates CRITICAL alert when fuel < 20%', async () => {
    query.mockResolvedValueOnce({ rows: [mkTel({ fuel_level_pct: 14.2 })] }); // telemetry
    query.mockResolvedValueOnce({ rows: [{ id:'a-1', vessel_id:'v-001', severity:'CRITICAL', category:'FUEL', title:'Low Fuel — MV Test Vessel', created_at: new Date() }] }); // insert

    await runAlertChecks();

    const insertCall = query.mock.calls[1];
    expect(insertCall[1][1]).toBe('CRITICAL');
    expect(insertCall[1][2]).toBe('FUEL');
    expect(broadcastEvent).toHaveBeenCalledWith('NEW_ALERT', expect.any(Object));
    expect(publish).toHaveBeenCalled();
  });

  it('creates WARNING alert when fuel 20–30%', async () => {
    query.mockResolvedValueOnce({ rows: [mkTel({ fuel_level_pct: 25.0 })] });
    query.mockResolvedValueOnce({ rows: [{ id:'a-2', severity:'WARNING', category:'FUEL', created_at: new Date() }] });

    await runAlertChecks();

    const insertCall = query.mock.calls[1];
    expect(insertCall[1][1]).toBe('WARNING');
    expect(insertCall[1][2]).toBe('FUEL');
  });

  it('creates CRITICAL alert when quantum coherence < 97%', async () => {
    query.mockResolvedValueOnce({ rows: [mkTel({ quantum_coherence_pct: 94.2 })] });
    query.mockResolvedValueOnce({ rows: [{ id:'a-3', severity:'CRITICAL', category:'QUANTUM', created_at: new Date() }] });

    await runAlertChecks();

    const calls = query.mock.calls;
    const alertInsert = calls.find(c => c[0].includes('INSERT INTO alerts'));
    expect(alertInsert[1][1]).toBe('CRITICAL');
    expect(alertInsert[1][2]).toBe('QUANTUM');
  });

  it('creates WARNING alert when LiDAR objects >= 4', async () => {
    query.mockResolvedValueOnce({ rows: [mkTel({ lidar_object_count: 5 })] });
    query.mockResolvedValueOnce({ rows: [{ id:'a-4', severity:'WARNING', category:'LIDAR', created_at: new Date() }] });

    await runAlertChecks();

    const alertInsert = query.mock.calls[1];
    expect(alertInsert[1][2]).toBe('LIDAR');
  });

  it('fires no alerts when all readings are nominal', async () => {
    query.mockResolvedValueOnce({ rows: [mkTel()] }); // nominal values

    await runAlertChecks();

    // Only 1 query (the telemetry select), no INSERT
    const insertCalls = query.mock.calls.filter(c => c[0].includes('INSERT INTO alerts'));
    expect(insertCalls).toHaveLength(0);
    expect(broadcastEvent).not.toHaveBeenCalled();
  });

  it('does not create duplicate alerts within cooldown window', async () => {
    // Simulate two consecutive ticks with low fuel
    for (let i = 0; i < 2; i++) {
      query.mockResolvedValueOnce({ rows: [mkTel({ fuel_level_pct: 14.2 })] });
      if (i === 0) query.mockResolvedValueOnce({ rows: [{ id:`a-${i}`, severity:'CRITICAL', category:'FUEL', created_at:new Date() }] });
    }
    await runAlertChecks();
    await runAlertChecks();
    const insertCalls = query.mock.calls.filter(c => c[0].includes('INSERT INTO alerts'));
    expect(insertCalls).toHaveLength(1); // only first tick inserts
  });

  it('handles DB errors gracefully without throwing', async () => {
    query.mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(runAlertChecks()).resolves.not.toThrow();
  });
});
