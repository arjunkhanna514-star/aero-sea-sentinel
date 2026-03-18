-- ============================================================
-- AERO-SEA SENTINEL — Seed Data
-- ============================================================

-- ─── ROLE PERMISSIONS ───────────────────────────────────────
INSERT INTO role_permissions (role, resource, action) VALUES
-- ADMIN: everything
('ADMIN','users','read'),('ADMIN','users','write'),('ADMIN','users','delete'),
('ADMIN','vessels','read'),('ADMIN','vessels','write'),('ADMIN','vessels','delete'),
('ADMIN','routes','read'),('ADMIN','routes','write'),('ADMIN','routes','approve'),
('ADMIN','telemetry','read'),('ADMIN','financials','read'),('ADMIN','financials','write'),
('ADMIN','server_nodes','read'),('ADMIN','server_nodes','write'),
('ADMIN','override_protocols','read'),('ADMIN','override_protocols','write'),
('ADMIN','alerts','read'),('ADMIN','alerts','write'),
-- FLEET_MANAGER
('FLEET_MANAGER','vessels','read'),('FLEET_MANAGER','vessels','write'),
('FLEET_MANAGER','routes','read'),('FLEET_MANAGER','routes','approve'),
('FLEET_MANAGER','telemetry','read'),
('FLEET_MANAGER','financials','read'),('FLEET_MANAGER','financials','write'),
('FLEET_MANAGER','alerts','read'),('FLEET_MANAGER','alerts','write'),
-- ANALYST
('ANALYST','telemetry','read'),
('ANALYST','financials','read'),
('ANALYST','routes','read'),
('ANALYST','vessels','read'),
('ANALYST','alerts','read'),
-- SENIOR_OPERATOR
('SENIOR_OPERATOR','vessels','read'),
('SENIOR_OPERATOR','routes','read'),('SENIOR_OPERATOR','routes','write'),
('SENIOR_OPERATOR','telemetry','read'),
('SENIOR_OPERATOR','quantum_swarm','approve'),
('SENIOR_OPERATOR','alerts','read'),('SENIOR_OPERATOR','alerts','write'),
-- OPERATOR
('OPERATOR','vessels','read'),
('OPERATOR','telemetry','read'),
('OPERATOR','routes','read'),
('OPERATOR','alerts','read'),
('OPERATOR','smart_skin','write'),
('OPERATOR','quantum_compass','read');

-- ─── DEMO USERS (password: "Sentinel2025!") ─────────────────
INSERT INTO users (id, email, password_hash, full_name, role) VALUES
('a0000000-0000-0000-0000-000000000001','admin@sentinel.io',   '$2b$12$LmockHashForAdminUser000000000', 'Admiral Chen Wei',      'ADMIN'),
('a0000000-0000-0000-0000-000000000002','fleet@sentinel.io',   '$2b$12$LmockHashForFleetManager00000', 'Captain Sofia Navarro', 'FLEET_MANAGER'),
('a0000000-0000-0000-0000-000000000003','analyst@sentinel.io', '$2b$12$LmockHashForAnalystUser000000', 'Dr. Lena Brandt',       'ANALYST'),
('a0000000-0000-0000-0000-000000000004','senior@sentinel.io',  '$2b$12$LmockHashForSeniorOp000000000', 'Commander Raj Patel',   'SENIOR_OPERATOR'),
('a0000000-0000-0000-0000-000000000005','operator@sentinel.io','$2b$12$LmockHashForOperatorUser00000', 'Ensign Yuki Tanaka',    'OPERATOR');

-- ─── VESSELS ────────────────────────────────────────────────
INSERT INTO vessels (id, name, callsign, type, status, smart_skin_enabled, smart_skin_panels, quantum_processor_id) VALUES
('b0000000-0000-0000-0000-000000000001','MV Pacific Sentinel',  'MVPS-01','SHIP',     'ACTIVE',TRUE,  2400,'QP-ALPHA-7'),
('b0000000-0000-0000-0000-000000000002','MV Atlantic Guardian', 'MVAG-02','SHIP',     'ACTIVE',TRUE,  2100,'QP-BETA-3'),
('b0000000-0000-0000-0000-000000000003','AS Horizon Eagle',     'ASHE-01','AIRCRAFT', 'ACTIVE',TRUE,   840,'QP-GAMMA-1'),
('b0000000-0000-0000-0000-000000000004','AS Quantum Falcon',    'ASQF-02','AIRCRAFT', 'IDLE',  FALSE,    0, NULL),
('b0000000-0000-0000-0000-000000000005','MV Shanghai Express',  'MVSE-03','SHIP',     'ACTIVE',TRUE,  1980,'QP-DELTA-5');

-- ─── FINANCIAL SNAPSHOTS (Last 30 days simulated) ───────────
INSERT INTO financial_snapshots (snapshot_date, vessel_id, fuel_savings_eur, ship_savings_eur, aircraft_savings_eur, total_savings_eur) VALUES
(CURRENT_DATE,      NULL, 18420.50, 8200.00, 10220.50, 18420.50),
(CURRENT_DATE - 1,  NULL, 17980.25, 7900.00,  9080.25, 17980.25),
(CURRENT_DATE - 7,  NULL, 15400.00, 6800.00,  8600.00, 15400.00),
(CURRENT_DATE - 30, NULL, 12100.00, 5200.00,  6900.00, 12100.00);

-- Vessel-specific: Shanghai Express case study (€40k/month ship savings)
INSERT INTO financial_snapshots (snapshot_date, vessel_id, fuel_savings_eur, shanghai_la_savings_eur, notes) VALUES
(CURRENT_DATE, 'b0000000-0000-0000-0000-000000000005', 41250.00, 41250.00, 'Shanghai–LA route: Smart Skin + Quantum Compass. Monthly target €40k. Currently exceeding by 3.1%.');

-- Aircraft case study (€1.2M/year = €100k/month)
INSERT INTO financial_snapshots (snapshot_date, vessel_id, fuel_savings_eur, aircraft_savings_eur, notes) VALUES
(CURRENT_DATE, 'b0000000-0000-0000-0000-000000000003', 102400.00, 102400.00, 'Horizon Eagle: Annual projection €1.228M. Smart Skin reducing drag 18.4%. Jet stream optimisation active.');

-- Fleet KPI snapshot
INSERT INTO fleet_kpis (total_vessels, active_vessels, fleet_fuel_savings_eur, fleet_co2_savings_kg, avg_drag_reduction_pct, avg_quantum_efficiency, daily_ship_savings_eur, daily_aircraft_savings_eur, routes_optimised, swarm_decisions_today)
VALUES (5, 4, 498200.00, 1240000.00, 16.8, 94.2, 40250.00, 102400.00, 847, 12);

-- ─── SERVER NODES ────────────────────────────────────────────
INSERT INTO server_nodes (name, ip_address, region, node_type, is_online) VALUES
('Core-EU-1',      '10.0.1.10', 'EU-WEST',    'CORE',      TRUE),
('Edge-Pacific-1', '10.0.2.10', 'APAC',       'EDGE',      TRUE),
('AI-Node-1',      '10.0.3.10', 'EU-WEST',    'AI',        TRUE),
('Telemetry-1',    '10.0.4.10', 'US-EAST',    'TELEMETRY', TRUE);

-- ─── SAMPLE ROUTES ───────────────────────────────────────────
INSERT INTO routes (vessel_id, name, origin, destination, status, distance_nm, is_quantum_swarm, swarm_confidence, fuel_savings_eur, created_by, approved_by)
VALUES
('b0000000-0000-0000-0000-000000000005','Shanghai–LA Express','Shanghai, CN','Los Angeles, CA','ACTIVE',5480.00,TRUE,97.4,41250.00,
  'a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002');
