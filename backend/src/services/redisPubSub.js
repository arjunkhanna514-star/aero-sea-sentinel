// src/services/redisPubSub.js
// Redis-backed pub/sub for broadcasting telemetry across multiple Node.js processes
// Allows horizontal scaling: any process can publish, all WS nodes receive

const { createClient } = require('redis');

const CHANNEL_TELEMETRY = 'sentinel:telemetry';
const CHANNEL_ALERTS    = 'sentinel:alerts';
const CHANNEL_EVENTS    = 'sentinel:events';

let publisher  = null;
let subscriber = null;
const handlers = new Map(); // channel → Set<callback>

function redisConfig() {
  return {
    socket: {
      host:            process.env.REDIS_HOST || 'localhost',
      port:            parseInt(process.env.REDIS_PORT || '6379'),
      reconnectStrategy: (attempts) => Math.min(attempts * 100, 3000),
    },
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

async function getPublisher() {
  if (publisher?.isReady) return publisher;
  publisher = createClient(redisConfig());
  publisher.on('error', (e) => console.error('[Redis PUB]', e.message));
  await publisher.connect();
  console.log('[Redis] Publisher connected');
  return publisher;
}

async function getSubscriber() {
  if (subscriber?.isReady) return subscriber;
  subscriber = createClient(redisConfig());
  subscriber.on('error', (e) => console.error('[Redis SUB]', e.message));
  await subscriber.connect();
  console.log('[Redis] Subscriber connected');
  return subscriber;
}

/**
 * Publish a message to a Redis channel
 * Called by telemetry broadcaster, alert controllers, etc.
 */
async function publish(channel, payload) {
  try {
    const pub = await getPublisher();
    await pub.publish(channel, JSON.stringify(payload));
  } catch (err) {
    console.error('[Redis PUB] publish error:', err.message);
  }
}

/**
 * Subscribe to a channel; callback receives parsed JSON payload
 */
async function subscribe(channel, callback) {
  const sub = await getSubscriber();
  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
    await sub.subscribe(channel, (message) => {
      try {
        const payload = JSON.parse(message);
        handlers.get(channel)?.forEach(cb => cb(payload));
      } catch (_) {}
    });
  }
  handlers.get(channel).add(callback);
  return () => handlers.get(channel)?.delete(callback); // returns unsubscribe fn
}

/**
 * Cache helpers (used for ephemeral live state)
 */
async function setCache(key, value, ttlSeconds = 60) {
  try {
    const pub = await getPublisher();
    await pub.setEx(`sentinel:cache:${key}`, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error('[Redis CACHE] set error:', err.message);
  }
}

async function getCache(key) {
  try {
    const pub = await getPublisher();
    const val = await pub.get(`sentinel:cache:${key}`);
    return val ? JSON.parse(val) : null;
  } catch (_) {
    return null;
  }
}

async function close() {
  await publisher?.quit();
  await subscriber?.quit();
}

module.exports = {
  publish, subscribe, setCache, getCache, close,
  CHANNEL_TELEMETRY, CHANNEL_ALERTS, CHANNEL_EVENTS,
};
