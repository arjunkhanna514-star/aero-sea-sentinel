// src/services/aiProxy.js
// Proxies AI chat requests to Python/Ollama service with SSE streaming
const axios = require('axios');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const AI_URL     = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '60000');

function createAIProxy(app, prefix) {
  /**
   * POST /ai/chat — non-streaming chat
   */
  app.post(`${prefix}/ai/chat`, authenticate, async (req, res, next) => {
    try {
      const { message, session_id } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

      // Build live context from DB
      const context = await buildLiveContext(req.user);

      // Save user message
      await saveMessage(req.user.id, session_id, 'user', message, context);

      const aiRes = await axios.post(`${AI_URL}/chat`, {
        message,
        context,
        user_role: req.user.role,
        session_id,
      }, { timeout: AI_TIMEOUT });

      const reply = aiRes.data.response;

      // Save assistant message
      await saveMessage(req.user.id, session_id, 'assistant', reply, context, aiRes.data.tokens_used, aiRes.data.response_ms);

      res.json({ response: reply, session_id });
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({ error: 'AI service unavailable. Is Ollama running?' });
      }
      next(err);
    }
  });

  /**
   * POST /ai/chat/stream — Server-Sent Events streaming
   */
  app.post(`${prefix}/ai/chat/stream`, authenticate, async (req, res) => {
    const { message, session_id } = req.body;
    if (!message?.trim()) {
      res.status(400).json({ error: 'Message required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control',  'no-cache');
    res.setHeader('Connection',     'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const context = await buildLiveContext(req.user);
      await saveMessage(req.user.id, session_id, 'user', message, context);

      const aiRes = await axios.post(`${AI_URL}/chat/stream`, {
        message,
        context,
        user_role: req.user.role,
        session_id,
      }, {
        responseType: 'stream',
        timeout: AI_TIMEOUT,
      });

      let fullReply = '';
      aiRes.data.on('data', (chunk) => {
        const text = chunk.toString();
        fullReply += text;
        res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
      });

      aiRes.data.on('end', async () => {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        await saveMessage(req.user.id, session_id, 'assistant', fullReply, context);
      });

      aiRes.data.on('error', (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });

    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: 'AI service error: ' + err.message })}\n\n`);
      res.end();
    }
  });

  /**
   * GET /ai/history?session_id=xxx
   */
  app.get(`${prefix}/ai/history`, authenticate, async (req, res, next) => {
    try {
      const { session_id } = req.query;
      const { rows } = await query(`
        SELECT role, content, created_at
        FROM ai_conversations
        WHERE user_id = $1 ${session_id ? 'AND session_id=$2' : ''}
        ORDER BY created_at ASC LIMIT 50
      `, session_id ? [req.user.id, session_id] : [req.user.id]);
      res.json(rows);
    } catch (err) { next(err); }
  });
}

// ─── Context Builder: inject live DB data into AI prompt ─────
async function buildLiveContext(user) {
  const [kpis, savings, vessels, alerts] = await Promise.all([
    query(`SELECT * FROM fleet_kpis ORDER BY recorded_at DESC LIMIT 1`),
    query(`SELECT SUM(fuel_savings_eur) AS total_fuel, SUM(ship_savings_eur) AS ship, SUM(aircraft_savings_eur) AS aircraft FROM financial_snapshots WHERE snapshot_date >= CURRENT_DATE - 30`),
    query(`SELECT name, callsign, type, status FROM vessels ORDER BY name`),
    query(`SELECT severity, title FROM alerts WHERE is_acknowledged=FALSE ORDER BY created_at DESC LIMIT 5`),
  ]);

  const latestTelemetry = await query(`
    SELECT DISTINCT ON (vessel_id) vessel_id,
      fuel_level_pct, drag_reduction_pct, quantum_temp_celsius, speed_knots, co2_kg_per_hour
    FROM telemetry ORDER BY vessel_id, time DESC
  `);

  return {
    user_role: user.role,
    fleet_kpis: kpis.rows[0] || {},
    savings_30d: savings.rows[0] || {},
    vessels: vessels.rows,
    active_alerts: alerts.rows,
    live_telemetry: latestTelemetry.rows,
    product_facts: {
      ship_annual_savings_target_eur: 500000,
      aircraft_annual_savings_target_eur: 1200000,
      monthly_ship_target_eur: 40000,
      case_study_shanghai_la: '€41,250/month fuel savings, 17.2% drag reduction',
      case_study_horizon_eagle: '€102,400/month, 18.4% drag reduction, projected €1.228M/year',
    },
  };
}

async function saveMessage(userId, sessionId, role, content, context, tokensUsed, responseMs) {
  try {
    await query(`
      INSERT INTO ai_conversations (user_id, session_id, role, content, context_snapshot, tokens_used, response_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [userId, sessionId || 'default', role, content, JSON.stringify(context), tokensUsed || null, responseMs || null]);
  } catch (_) {}
}

module.exports = { createAIProxy };
