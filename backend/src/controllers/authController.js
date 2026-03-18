// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { auditLog } = require('../services/auditService');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS    = 5;
const loginAttempts   = new Map(); // in-memory; use Redis in production

const checkBrute = (ip) => {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAt: now };
  if (now - record.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
    return false;
  }
  if (record.count >= MAX_ATTEMPTS) return true;
  record.count++;
  loginAttempts.set(ip, record);
  return false;
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const ip = req.ip;

    if (checkBrute(ip)) {
      return res.status(429).json({ error: 'Too many login attempts. Wait 15 minutes.' });
    }

    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Create session
    const sessionId   = uuidv4();
    const tokenHash   = crypto.randomBytes(32).toString('hex');
    const expiresAt   = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

    await query(
      `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, ip, req.headers['user-agent'], expiresAt]
    );

    await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

    const token = jwt.sign(
      { userId: user.id, role: user.role, tokenHash },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await auditLog(user.id, 'LOGIN', 'users', user.id, null, null, ip);

    res.json({
      token,
      user: {
        id:       user.id,
        email:    user.email,
        fullName: user.full_name,
        role:     user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token);
      if (decoded?.tokenHash) {
        await query(
          `DELETE FROM user_sessions WHERE token_hash = $1`,
          [decoded.tokenHash]
        );
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  const { rows } = await query(
    `SELECT id, email, full_name, role, last_login, created_at FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json(rows[0]);
};
