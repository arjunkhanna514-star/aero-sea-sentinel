-- ============================================================
-- AERO-SEA SENTINEL — Complete PostgreSQL Schema
-- Roles: ADMIN, FLEET_MANAGER, ANALYST, SENIOR_OPERATOR, OPERATOR
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE; -- for time-series telemetry

-- ─────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'FLEET_MANAGER',
  'ANALYST',
  'SENIOR_OPERATOR',
  'OPERATOR'
);

CREATE TYPE vessel_type AS ENUM ('SHIP', 'AIRCRAFT');
CREATE TYPE vessel_status AS ENUM ('ACTIVE', 'IDLE', 'MAINTENANCE', 'EMERGENCY');
CREATE TYPE route_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED');
CREATE TYPE alert_severity AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY');
CREATE TYPE swarm_decision AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ─────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            user_role NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(512) NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  id              SERIAL PRIMARY KEY,
  role            user_role NOT NULL,
  resource        VARCHAR(100) NOT NULL,  -- e.g. 'vessel', 'route', 'telemetry'
  action          VARCHAR(50)  NOT NULL,  -- e.g. 'read', 'write', 'approve', 'delete'
  UNIQUE(role, resource, action)
);

-- ─────────────────────────────────────────
-- VESSELS (Ships + Aircraft)
-- ─────────────────────────────────────────
CREATE TABLE vessels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  callsign        VARCHAR(50) UNIQUE NOT NULL,
  type            vessel_type NOT NULL,
  status          vessel_status DEFAULT 'IDLE',
  manufacturer    VARCHAR(255),
  model           VARCHAR(255),
  year_built      INTEGER,
  max_capacity_kg NUMERIC(12,2),
  fuel_capacity_l NUMERIC(12,2),
  -- Smart Skin system
  smart_skin_enabled BOOLEAN DEFAULT FALSE,
  smart_skin_panels  INTEGER DEFAULT 0,
  -- Quantum systems
  quantum_processor_id VARCHAR(100),
  assigned_operator_id UUID REFERENCES users(id),
  fleet_manager_id     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- LIVE TELEMETRY (TimescaleDB hypertable)
-- ─────────────────────────────────────────
CREATE TABLE telemetry (
  time                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vessel_id               UUID NOT NULL REFERENCES vessels(id),
  -- Position
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  altitude_m              DOUBLE PRECISION,        -- aircraft only
  depth_m                 DOUBLE PRECISION,        -- submarine / sub-surface
  heading_deg             DOUBLE PRECISION,
  speed_knots             DOUBLE PRECISION,
  -- Fuel
  fuel_level_pct          NUMERIC(5,2),
  fuel_burn_rate_lph      NUMERIC(10,4),           -- litres per hour
  fuel_saved_l            NUMERIC(12,4) DEFAULT 0,
  -- Smart Skin drag
  drag_coefficient        NUMERIC(8,6),
  drag_reduction_pct      NUMERIC(5,2),
  smart_skin_active_zones INTEGER,
  micro_adjustment_count  INTEGER DEFAULT 0,
  -- Quantum Processor
  quantum_temp_celsius    NUMERIC(6,2),
  quantum_cpu_load_pct    NUMERIC(5,2),
  quantum_coherence_pct   NUMERIC(5,2),
  -- Eagle Eye LiDAR
  lidar_range_m           NUMERIC(10,2),
  lidar_object_count      INTEGER DEFAULT 0,
  lidar_visibility_pct    NUMERIC(5,2),
  -- Environmental
  wind_speed_ms           NUMERIC(8,2),
  wind_direction_deg      NUMERIC(5,1),
  wave_height_m           NUMERIC(6,2),
  jet_stream_velocity_ms  NUMERIC(8,2),
  sea_temp_celsius        NUMERIC(5,2),
  air_temp_celsius        NUMERIC(5,2),
  -- Emissions
  co2_kg_per_hour         NUMERIC(10,4),
  nox_g_per_hour          NUMERIC(10,4)
);

SELECT create_hypertable('telemetry', 'time');
CREATE INDEX ON telemetry (vessel_id, time DESC);

-- ─────────────────────────────────────────
-- ROUTES
-- ─────────────────────────────────────────
CREATE TABLE routes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vessel_id       UUID NOT NULL REFERENCES vessels(id),
  name            VARCHAR(255) NOT NULL,
  origin          VARCHAR(255) NOT NULL,
  destination     VARCHAR(255) NOT NULL,
  origin_coords   POINT,
  dest_coords     POINT,
  status          route_status DEFAULT 'PENDING',
  distance_nm     NUMERIC(10,2),
  estimated_hours NUMERIC(8,2),
  -- Quantum Swarm optimised
  is_quantum_swarm  BOOLEAN DEFAULT FALSE,
  swarm_confidence  NUMERIC(5,2),               -- % confidence from swarm algo
  ai_recommended    BOOLEAN DEFAULT FALSE,
  -- Approvals
  created_by      UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),    -- must be SENIOR_OPERATOR or FLEET_MANAGER
  approved_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  -- Financial
  estimated_fuel_cost_eur  NUMERIC(12,2),
  actual_fuel_cost_eur     NUMERIC(12,2),
  fuel_savings_eur         NUMERIC(12,2),
  co2_savings_kg           NUMERIC(12,2),
  waypoints       JSONB DEFAULT '[]',           -- [{lat, lon, name, eta}]
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Quantum Swarm route change requests (require SENIOR_OPERATOR sign-off)
CREATE TABLE quantum_swarm_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id        UUID NOT NULL REFERENCES routes(id),
  vessel_id       UUID NOT NULL REFERENCES vessels(id),
  requested_by    UUID NOT NULL REFERENCES users(id),
  reviewed_by     UUID REFERENCES users(id),
  decision        swarm_decision DEFAULT 'PENDING',
  original_waypoints JSONB,
  proposed_waypoints JSONB,
  swarm_rationale    TEXT,
  fuel_delta_eur     NUMERIC(10,2),
  time_delta_min     NUMERIC(8,2),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- FINANCIAL DATA
-- ─────────────────────────────────────────
CREATE TABLE financial_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   DATE NOT NULL,
  vessel_id       UUID REFERENCES vessels(id), -- NULL = fleet-wide
  -- Savings targets from brief
  fuel_savings_eur        NUMERIC(14,2) DEFAULT 0,
  maintenance_savings_eur NUMERIC(14,2) DEFAULT 0,
  total_savings_eur       NUMERIC(14,2) DEFAULT 0,
  -- Vessel-type specific
  ship_savings_eur        NUMERIC(14,2) DEFAULT 0,   -- target €250k/ship
  aircraft_savings_eur    NUMERIC(14,2) DEFAULT 0,   -- target €1.2M/aircraft
  -- Revenue
  route_revenue_eur       NUMERIC(14,2) DEFAULT 0,
  -- Smart skin contribution
  smart_skin_savings_eur  NUMERIC(14,2) DEFAULT 0,
  -- Quantum compass contribution
  quantum_nav_savings_eur NUMERIC(14,2) DEFAULT 0,
  -- Case study anchors
  shanghai_la_savings_eur NUMERIC(14,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fleet_kpis (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),
  -- Fleet-wide aggregates (€500k ship, €1.2M aircraft from brief)
  total_vessels           INTEGER,
  active_vessels          INTEGER,
  fleet_fuel_savings_eur  NUMERIC(14,2),
  fleet_co2_savings_kg    NUMERIC(14,2),
  avg_drag_reduction_pct  NUMERIC(5,2),
  avg_quantum_efficiency  NUMERIC(5,2),
  -- 40k/250k daily targets
  daily_ship_savings_eur  NUMERIC(12,2),
  daily_aircraft_savings_eur NUMERIC(12,2),
  routes_optimised        INTEGER,
  swarm_decisions_today   INTEGER
);

-- ─────────────────────────────────────────
-- ALERTS & EVENTS
-- ─────────────────────────────────────────
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vessel_id       UUID REFERENCES vessels(id),
  severity        alert_severity NOT NULL,
  category        VARCHAR(100),   -- 'LIDAR', 'QUANTUM', 'SMART_SKIN', 'FUEL', 'WEATHER'
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  auto_resolved   BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SERVER NODES (ADMIN only)
-- ─────────────────────────────────────────
CREATE TABLE server_nodes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  ip_address      INET NOT NULL,
  region          VARCHAR(100),
  node_type       VARCHAR(50),   -- 'EDGE', 'CORE', 'AI', 'TELEMETRY'
  is_online       BOOLEAN DEFAULT TRUE,
  cpu_load_pct    NUMERIC(5,2),
  memory_used_pct NUMERIC(5,2),
  disk_used_pct   NUMERIC(5,2),
  last_heartbeat  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Global override protocols (ADMIN only)
CREATE TABLE override_protocols (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT FALSE,
  activated_by    UUID REFERENCES users(id),
  activated_at    TIMESTAMPTZ,
  deactivated_at  TIMESTAMPTZ,
  scope           VARCHAR(50),   -- 'GLOBAL', 'FLEET', 'VESSEL'
  target_id       UUID,          -- vessel_id if scope=VESSEL
  payload         JSONB DEFAULT '{}'
);

-- ─────────────────────────────────────────
-- AI ASSISTANT CONVERSATION HISTORY
-- ─────────────────────────────────────────
CREATE TABLE ai_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  session_id      UUID NOT NULL,
  role            VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  -- Context injected into LLM
  context_snapshot JSONB DEFAULT '{}',  -- live DB data at time of query
  tokens_used     INTEGER,
  response_ms     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  action          VARCHAR(255) NOT NULL,
  resource_type   VARCHAR(100),
  resource_id     UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_vessels_status ON vessels(status);
CREATE INDEX idx_routes_vessel ON routes(vessel_id);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_alerts_vessel ON alerts(vessel_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, session_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_financial_date ON financial_snapshots(snapshot_date DESC);
