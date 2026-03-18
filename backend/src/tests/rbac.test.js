// src/tests/rbac.test.js
const { requireRole, requireMinRole } = require('../middleware/auth');

// Mock req/res/next
const mockReq = (role) => ({ user: { id: 'u-1', role, email: 'test@test.io' } });
const mockRes = () => {
  const res = {};
  res.status  = jest.fn().mockReturnValue(res);
  res.json    = jest.fn().mockReturnValue(res);
  return res;
};
const next = jest.fn();

beforeEach(() => next.mockClear());

describe('requireRole()', () => {
  it('passes when role matches', () => {
    const mw  = requireRole('ADMIN');
    const res = mockRes();
    mw(mockReq('ADMIN'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes when role is one of multiple allowed', () => {
    const mw  = requireRole('ADMIN', 'FLEET_MANAGER');
    const res = mockRes();
    mw(mockReq('FLEET_MANAGER'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks when role is not allowed', () => {
    const mw  = requireRole('ADMIN');
    const res = mockRes();
    mw(mockReq('OPERATOR'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks unauthenticated requests (no user)', () => {
    const mw  = requireRole('ADMIN');
    const res = mockRes();
    mw({ user: null }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireMinRole()', () => {
  const HIERARCHY = ['OPERATOR', 'SENIOR_OPERATOR', 'ANALYST', 'FLEET_MANAGER', 'ADMIN'];

  test.each([
    ['ADMIN',           'OPERATOR',        true],
    ['FLEET_MANAGER',   'OPERATOR',        true],
    ['SENIOR_OPERATOR', 'SENIOR_OPERATOR', true],
    ['OPERATOR',        'SENIOR_OPERATOR', false],
    ['OPERATOR',        'ADMIN',           false],
    ['ANALYST',         'FLEET_MANAGER',   false],
    ['ANALYST',         'ANALYST',         true],
  ])('%s accessing %s min-role → %s', (userRole, minRole, shouldPass) => {
    const mw  = requireMinRole(minRole);
    const res = mockRes();
    mw(mockReq(userRole), res, next);
    if (shouldPass) {
      expect(next).toHaveBeenCalledTimes(1);
    } else {
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }
    next.mockClear();
  });
});

describe('Role permission matrix — Quantum Swarm', () => {
  // SENIOR_OPERATOR and ADMIN can approve swarm requests; others cannot
  const canApprove = ['SENIOR_OPERATOR', 'ADMIN'];
  const cannot     = ['OPERATOR', 'ANALYST', 'FLEET_MANAGER'];

  canApprove.forEach(role => {
    it(`${role} CAN review swarm requests`, () => {
      const mw  = requireRole('SENIOR_OPERATOR', 'ADMIN');
      const res = mockRes();
      mw(mockReq(role), res, next);
      expect(next).toHaveBeenCalledTimes(1);
      next.mockClear();
    });
  });

  cannot.forEach(role => {
    it(`${role} CANNOT review swarm requests`, () => {
      const mw  = requireRole('SENIOR_OPERATOR', 'ADMIN');
      const res = mockRes();
      mw(mockReq(role), res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      next.mockClear();
    });
  });
});
