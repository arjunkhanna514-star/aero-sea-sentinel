// src/services/metrics.js
// Exposes /metrics endpoint for Prometheus scraping
// Tracks: HTTP request rates, WS connections, DB query times, telemetry ingestion rate

const { query } = require('../db/pool');

// Lightweight in-memory counters (replace with prom-client in production)
const counters = {
  http_requests_total: 0,
  http_errors_total:   0,
  ws_connections_active: 0,
  telemetry_rows_ingested: 0,
  ai_requests_total:   0,
  auth_logins_total:   0,
  auth_failures_total: 0,
};
const histograms = {
  http_request_duration_ms: [],
  db_query_duration_ms:     [],
  ai_response_duration_ms:  [],
};

// Record HTTP metrics via middleware
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    counters.http_requests_total++;
    if (res.statusCode >= 400) counters.http_errors_total++;
    const dur = Date.now() - start;
    histograms.http_request_duration_ms.push(dur);
    if (histograms.http_request_duration_ms.length > 1000) {
      histograms.http_request_duration_ms.shift();
    }
  });
  next();
}

function increment(counter) {
  if (counters[counter] !== undefined) counters[counter]++;
}

function recordDuration(histogram, ms) {
  if (histograms[histogram]) {
    histograms[histogram].push(ms);
    if (histograms[histogram].length > 500) histograms[histogram].shift();
  }
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx    = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// Generate Prometheus text format
async function generateMetrics() {
  let dbRows = 0;
  let activeVessels = 0;
  try {
    const r1 = await query(`SELECT COUNT(*) FROM telemetry WHERE time > NOW() - INTERVAL '1 minute'`);
    dbRows = parseInt(r1.rows[0].count);
    const r2 = await query(`SELECT COUNT(*) FROM vessels WHERE status='ACTIVE'`);
    activeVessels = parseInt(r2.rows[0].count);
  } catch (_) {}

  const p50http = percentile(histograms.http_request_duration_ms, 50);
  const p95http = percentile(histograms.http_request_duration_ms, 95);
  const p99http = percentile(histograms.http_request_duration_ms, 99);

  return [
    '# HELP sentinel_http_requests_total Total HTTP requests',
    '# TYPE sentinel_http_requests_total counter',
    `sentinel_http_requests_total ${counters.http_requests_total}`,

    '# HELP sentinel_http_errors_total Total HTTP 4xx/5xx errors',
    '# TYPE sentinel_http_errors_total counter',
    `sentinel_http_errors_total ${counters.http_errors_total}`,

    '# HELP sentinel_http_request_duration_ms HTTP request duration',
    '# TYPE sentinel_http_request_duration_ms summary',
    `sentinel_http_request_duration_ms{quantile="0.5"} ${p50http}`,
    `sentinel_http_request_duration_ms{quantile="0.95"} ${p95http}`,
    `sentinel_http_request_duration_ms{quantile="0.99"} ${p99http}`,

    '# HELP sentinel_ws_connections_active Active WebSocket connections',
    '# TYPE sentinel_ws_connections_active gauge',
    `sentinel_ws_connections_active ${counters.ws_connections_active}`,

    '# HELP sentinel_telemetry_rows_ingested_total Total telemetry rows ingested',
    '# TYPE sentinel_telemetry_rows_ingested_total counter',
    `sentinel_telemetry_rows_ingested_total ${counters.telemetry_rows_ingested}`,

    '# HELP sentinel_telemetry_rows_last_minute Telemetry rows in last 60s (DB)',
    '# TYPE sentinel_telemetry_rows_last_minute gauge',
    `sentinel_telemetry_rows_last_minute ${dbRows}`,

    '# HELP sentinel_active_vessels Currently active vessels',
    '# TYPE sentinel_active_vessels gauge',
    `sentinel_active_vessels ${activeVessels}`,

    '# HELP sentinel_ai_requests_total Total AI assistant requests',
    '# TYPE sentinel_ai_requests_total counter',
    `sentinel_ai_requests_total ${counters.ai_requests_total}`,

    '# HELP sentinel_auth_logins_total Total successful logins',
    '# TYPE sentinel_auth_logins_total counter',
    `sentinel_auth_logins_total ${counters.auth_logins_total}`,

    '# HELP sentinel_auth_failures_total Total failed login attempts',
    '# TYPE sentinel_auth_failures_total counter',
    `sentinel_auth_failures_total ${counters.auth_failures_total}`,

    `# HELP sentinel_process_uptime_seconds Process uptime`,
    `# TYPE sentinel_process_uptime_seconds gauge`,
    `sentinel_process_uptime_seconds ${process.uptime().toFixed(2)}`,

    `# HELP sentinel_process_memory_bytes RSS memory usage`,
    `# TYPE sentinel_process_memory_bytes gauge`,
    `sentinel_process_memory_bytes ${process.memoryUsage().rss}`,

    '',
  ].join('\n');
}

module.exports = { metricsMiddleware, generateMetrics, increment, recordDuration };
