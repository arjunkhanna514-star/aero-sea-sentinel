// src/components/fleet-manager/FleetMap.jsx
// Live fleet map — SVG world map with animated vessel positions,
// route lines, and live telemetry popups.
// Uses pure SVG/CSS (no external map library needed — works offline)

import { useState, useEffect, useRef } from 'react';

// Simplified world map path (Mercator projection, 960×500 viewport)
const WORLD_PATH = "M150,120 L180,115 L200,118 L220,125 L240,130 L260,128 L280,132 L300,135 L320,130 L340,128 L360,125 L380,122 L400,118 L420,115 L440,112 L460,110 L480,108 L500,105 L520,108 L540,112 L560,118 L580,122 L600,128 L620,132 L640,135 L660,138 L680,140 L700,138 L720,135 L740,132 L760,130 L780,128 L800,125 L820,122 L840,118 L860,115 L880,112 L900,110";

// Convert lat/lon to SVG x/y (simple equirectangular)
function latLonToSVG(lat, lon, w = 960, h = 500) {
  const x = (lon + 180) * (w / 360);
  const y = (90 - lat) * (h / 180);
  return { x, y };
}

// Vessel data with live-updating positions
const INITIAL_VESSELS = [
  { id:'v1', name:'MV Pacific Sentinel',  callsign:'MVPS-01', type:'SHIP',     lat:35.8, lon:-140.2, heading:285, speed:18.4, fuel:62.4, drag:17.2, status:'ACTIVE',  color:'#00c9ff', route:{ destLat:33.7,  destLon:-118.2 } },
  { id:'v2', name:'MV Atlantic Guardian', callsign:'MVAG-02', type:'SHIP',     lat:42.1, lon:-32.4,  heading:058, speed:15.1, fuel:78.1, drag:15.8, status:'ACTIVE',  color:'#7ee8a2', route:{ destLat:51.5,  destLon:-0.1   } },
  { id:'v3', name:'AS Horizon Eagle',     callsign:'ASHE-01', type:'AIRCRAFT', lat:51.2, lon:12.4,   heading:290, speed:478,  fuel:54.2, drag:18.4, status:'ACTIVE',  color:'#ffb347', route:{ destLat:40.7,  destLon:-74.0  } },
  { id:'v4', name:'AS Quantum Falcon',    callsign:'ASQF-02', type:'AIRCRAFT', lat:35.7, lon:139.7,  heading:195, speed:452,  fuel:81.0, drag:0,    status:'IDLE',    color:'#9b6dff', route:{ destLat:1.4,   destLon:103.8  } },
  { id:'v5', name:'MV Shanghai Express',  callsign:'MVSE-03', type:'SHIP',     lat:24.4, lon:155.8,  heading:065, speed:21.2, fuel:44.8, drag:17.0, status:'ACTIVE',  color:'#00e5a0', route:{ destLat:33.7,  destLon:-118.2 } },
];

// Key ports/airports for context
const WAYPOINTS = [
  { name:'Shanghai',    lat:31.2, lon:121.5 },
  { name:'Los Angeles', lat:33.9, lon:-118.4 },
  { name:'London',      lat:51.5, lon:-0.1  },
  { name:'Tokyo',       lat:35.7, lon:139.8 },
  { name:'New York',    lat:40.7, lon:-74.0 },
  { name:'Frankfurt',   lat:50.0, lon:8.7   },
  { name:'Singapore',   lat:1.4,  lon:103.8 },
];

export default function FleetMap() {
  const [vessels,  setVessels]  = useState(INITIAL_VESSELS);
  const [selected, setSelected] = useState(null);
  const [trails,   setTrails]   = useState(() =>
    Object.fromEntries(INITIAL_VESSELS.map(v => [v.id, [{ lat: v.lat, lon: v.lon }]]))
  );
  const svgRef = useRef(null);

  // Animate vessel movement every second
  useEffect(() => {
    const id = setInterval(() => {
      setVessels(vs => vs.map(v => {
        if (v.status !== 'ACTIVE') return v;
        const speed   = v.type === 'AIRCRAFT' ? 0.0004 : 0.0001;
        const dlat    = Math.cos(v.heading * Math.PI / 180) * speed * v.speed;
        const dlon    = Math.sin(v.heading * Math.PI / 180) * speed * v.speed;
        const newLat  = v.lat + dlat + (Math.random() - 0.5) * 0.002;
        const newLon  = v.lon + dlon + (Math.random() - 0.5) * 0.003;
        return {
          ...v,
          lat:   newLat,
          lon:   newLon,
          speed: +(v.speed + (Math.random() - 0.5) * (v.type === 'AIRCRAFT' ? 4 : 0.2)).toFixed(1),
          fuel:  +(v.fuel  - 0.0004).toFixed(4),
          drag:  v.drag > 0 ? +(v.drag + (Math.random() - 0.5) * 0.05).toFixed(2) : 0,
        };
      }));

      setTrails(prev => {
        const next = { ...prev };
        setVessels(vs => {
          vs.forEach(v => {
            if (v.status !== 'ACTIVE') return;
            next[v.id] = [...(prev[v.id] || []).slice(-20), { lat: v.lat, lon: v.lon }];
          });
          return vs;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const sel = vessels.find(v => v.id === selected);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-void)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '0.06em' }}>
            FLEET MAP
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {vessels.filter(v => v.status === 'ACTIVE').length} vessels active · live positions · 1s refresh
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[['#00c9ff','SHIP'],['#ffb347','AIRCRAFT'],['rgba(255,60,90,0.7)','ALERT']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: l === 'SHIP' ? 2 : '50%', background: c }}/>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map + sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG Map */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 960 500"
            style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #04060d 0%, #070b14 60%, #0a1020 100%)' }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Ocean grid */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,201,255,0.04)" strokeWidth="0.5"/>
              </pattern>
              {/* Glow filters */}
              <filter id="glow-blue">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-green">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              {/* Vessel trail gradient */}
              {vessels.map(v => (
                <linearGradient key={v.id} id={`trail-${v.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={v.color} stopOpacity="0"/>
                  <stop offset="100%" stopColor={v.color} stopOpacity="0.6"/>
                </linearGradient>
              ))}
            </defs>

            {/* Ocean background grid */}
            <rect width="960" height="500" fill="url(#grid)"/>

            {/* Simplified continent shapes */}
            <g opacity="0.18">
              {/* North America */}
              <path d="M 80,80 L 120,75 L 160,78 L 200,85 L 220,100 L 230,130 L 220,160 L 200,180 L 180,200 L 160,220 L 150,240 L 140,260 L 120,280 L 100,290 L 90,270 L 85,240 L 80,210 L 75,180 L 72,150 L 70,120 Z" fill="#1a3050" stroke="rgba(0,201,255,0.15)" strokeWidth="0.5"/>
              {/* South America */}
              <path d="M 155,280 L 175,278 L 195,285 L 205,300 L 210,330 L 205,360 L 195,390 L 175,410 L 155,415 L 140,400 L 135,370 L 138,340 L 142,310 Z" fill="#1a3050" stroke="rgba(0,201,255,0.15)" strokeWidth="0.5"/>
              {/* Europe */}
              <path d="M 430,70 L 470,65 L 510,68 L 540,75 L 550,90 L 540,105 L 520,115 L 500,120 L 480,115 L 460,110 L 440,100 L 425,90 Z" fill="#1a3050" stroke="rgba(0,201,255,0.15)" strokeWidth="0.5"/>
              {/* Africa */}
              <path d="M 450,130 L 490,125 L 530,130 L 555,150 L 560,190 L 545,240 L 520,280 L 490,310 L 460,290 L 440,250 L 435,200 L 440,160 Z" fill="#1a3050" stroke="rgba(0,201,255,0.15)" strokeWidth="0.5"/>
              {/* Asia */}
              <path d="M 550,60 L 640,50 L 720,55 L 790,70 L 840,90 L 860,115 L 840,135 L 800,145 L 760,150 L 720,145 L 680,140 L 640,135 L 600,125 L 570,110 L 555,90 Z" fill="#1a3050" stroke="rgba(0,201,255,0.15)" strokeWidth="0.5"/>
              {/* Australia */}
              <path d="M 720,310 L 760,305 L 800,315 L 825,340 L 820,370 L 790,385 L 750,382 L 720,365 L 710,340 Z" fill="#1a3050" stroke="rgba(0,201,255,0.15)" strokeWidth="0.5"/>
            </g>

            {/* Route destination lines */}
            {vessels.filter(v => v.status === 'ACTIVE').map(v => {
              const from = latLonToSVG(v.lat, v.lon);
              const to   = latLonToSVG(v.route.destLat, v.route.destLon);
              // Great circle approximation (midpoint offset)
              const mx   = (from.x + to.x) / 2;
              const my   = (from.y + to.y) / 2 - 30;
              return (
                <path
                  key={v.id}
                  d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                  fill="none"
                  stroke={v.color}
                  strokeWidth="0.8"
                  strokeDasharray="4 6"
                  opacity="0.25"
                />
              );
            })}

            {/* Vessel trail lines */}
            {vessels.map(v => {
              const trail = trails[v.id] || [];
              if (trail.length < 2) return null;
              const points = trail.map(p => {
                const { x, y } = latLonToSVG(p.lat, p.lon);
                return `${x},${y}`;
              }).join(' ');
              return (
                <polyline
                  key={`trail-${v.id}`}
                  points={points}
                  fill="none"
                  stroke={v.color}
                  strokeWidth="1.2"
                  opacity="0.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Port/Airport markers */}
            {WAYPOINTS.map(wp => {
              const { x, y } = latLonToSVG(wp.lat, wp.lon);
              return (
                <g key={wp.name}>
                  <circle cx={x} cy={y} r={2.5} fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5}/>
                  <text x={x + 4} y={y - 3} fontFamily="IBM Plex Mono" fontSize="6" fill="rgba(255,255,255,0.25)">{wp.name}</text>
                </g>
              );
            })}

            {/* Vessels */}
            {vessels.map(v => {
              const { x, y } = latLonToSVG(v.lat, v.lon);
              const isSelected = v.id === selected;
              const isAir = v.type === 'AIRCRAFT';
              const alert = v.fuel < 30;

              return (
                <g
                  key={v.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(v.id === selected ? null : v.id)}
                  filter={isSelected ? 'url(#glow-blue)' : undefined}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle r={14} fill="none" stroke={v.color} strokeWidth={1} opacity={0.5}
                      style={{ animation: 'pulse-ring 1.5s ease-out infinite' }}
                    />
                  )}
                  {/* Alert pulse */}
                  {alert && (
                    <circle r={10} fill="none" stroke="#ff3c5a" strokeWidth={0.8} opacity={0.4}
                      style={{ animation: 'pulse-ring 2s ease-out infinite' }}
                    />
                  )}
                  {/* Vessel icon — rotated to heading */}
                  <g transform={`rotate(${v.heading})`}>
                    {isAir ? (
                      // Aircraft icon
                      <g fill={v.color}>
                        <polygon points="0,-7 2,-2 6,0 2,1 0,5 -2,1 -6,0 -2,-2" opacity={v.status === 'ACTIVE' ? 1 : 0.4}/>
                      </g>
                    ) : (
                      // Ship icon
                      <g fill={v.color}>
                        <polygon points="0,-8 3,3 0,1 -3,3" opacity={v.status === 'ACTIVE' ? 1 : 0.4}/>
                        <rect x="-3" y="1" width="6" height="3" opacity={v.status === 'ACTIVE' ? 0.7 : 0.3}/>
                      </g>
                    )}
                  </g>
                  {/* Callsign label */}
                  <text y={-12} textAnchor="middle"
                    fontFamily="IBM Plex Mono" fontSize="7"
                    fill={v.color} opacity={0.9}
                  >{v.callsign}</text>
                  {/* Speed indicator */}
                  <text y={16} textAnchor="middle"
                    fontFamily="IBM Plex Mono" fontSize="6"
                    fill="rgba(255,255,255,0.4)"
                  >{isAir ? `${Math.round(v.speed)}kn` : `${v.speed}kn`}</text>
                </g>
              );
            })}
          </svg>

          {/* Timestamp overlay */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12,
            fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
            color: 'rgba(255,255,255,0.3)',
          }}>
            {new Date().toUTCString()}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width: 280, background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {sel ? (
            <VesselDetail vessel={sel} onClose={() => setSelected(null)} />
          ) : (
            <VesselList vessels={vessels} onSelect={setSelected} />
          )}
        </div>
      </div>
    </div>
  );
}

function VesselList({ vessels, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          VESSEL REGISTRY
        </div>
      </div>
      <div className="scroll-area" style={{ flex: 1 }}>
        {vessels.map(v => (
          <button key={v.id} onClick={() => onSelect(v.id)}
            style={{
              width: '100%', padding: '12px 16px', background: 'none', border: 'none',
              borderBottom: '1px solid var(--border-dim)', cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: v.type === 'AIRCRAFT' ? '50%' : 1, background: v.color }}/>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  {v.callsign}
                </span>
              </div>
              <div className={`badge badge-${v.status === 'ACTIVE' ? 'active' : 'idle'}`}>{v.status}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              {v.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {[
                ['SPD', v.type === 'AIRCRAFT' ? `${Math.round(v.speed)}` : `${v.speed}`, 'kn'],
                ['FUEL', v.fuel.toFixed(0), '%'],
                ['DRAG↓', v.drag > 0 ? v.drag.toFixed(1) : '—', v.drag > 0 ? '%' : ''],
              ].map(([k, val, u]) => (
                <div key={k} style={{ textAlign: 'center', padding: '4px 0', background: 'var(--bg-raised)', borderRadius: 3 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-dim)' }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: v.fuel < 30 && k === 'FUEL' ? 'var(--status-red)' : 'var(--accent-text)' }}>
                    {val}<span style={{ fontSize: '0.55rem', opacity: 0.6 }}>{u}</span>
                  </div>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function VesselDetail({ vessel: v, onClose }) {
  const isAir = v.type === 'AIRCRAFT';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: v.color }}>
            {v.callsign}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{v.name}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: 16 }}>
        {/* Status */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div className={`badge badge-${v.status === 'ACTIVE' ? 'active' : 'idle'}`}>{v.status}</div>
          <div className="badge badge-idle">{v.type}</div>
        </div>

        {/* Position */}
        <Section title="POSITION">
          <Row k="LAT"     v={v.lat.toFixed(4) + '°N'} />
          <Row k="LON"     v={Math.abs(v.lon).toFixed(4) + (v.lon < 0 ? '°W' : '°E')} />
          <Row k="HEADING" v={v.heading.toFixed(1) + '°'} />
          {isAir && <Row k="ALTITUDE" v="FL370" />}
        </Section>

        {/* Performance */}
        <Section title="PERFORMANCE">
          <Row k="SPEED"    v={`${v.speed}${isAir ? '' : ''} kn`} />
          <Row k="FUEL"     v={`${v.fuel.toFixed(2)}%`} c={v.fuel < 30 ? 'var(--status-red)' : undefined} />
          <Row k="DRAG ↓"  v={v.drag > 0 ? v.drag.toFixed(2) + '%' : 'N/A'} c={v.drag > 14 ? 'var(--status-green)' : undefined} />
        </Section>

        {/* Route */}
        <Section title="ROUTE">
          <Row k="ORIGIN"  v={v.lon > 100 ? 'Asia-Pacific' : v.lon > 0 ? 'Europe' : 'Americas'} />
          <Row k="DEST"    v={v.route.destLon < -100 ? 'Los Angeles' : v.route.destLon < 0 ? 'New York/London' : 'Singapore'} />
        </Section>

        {/* Financial impact */}
        {v.drag > 0 && (
          <Section title="SAVINGS IMPACT">
            <Row k="MONTHLY" v={`€${v.type === 'AIRCRAFT' ? '102,400' : '41,250'}`} c="var(--status-green)" />
            <Row k="ANNUAL"  v={`€${v.type === 'AIRCRAFT' ? '1,228,800' : '495,000'}`} c="var(--status-green)" />
          </Section>
        )}

        {/* Fuel warning */}
        {v.fuel < 30 && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,60,90,0.08)', border: '1px solid rgba(255,60,90,0.3)', borderRadius: 6, marginTop: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--status-red)' }}>
              ⚠ FUEL BELOW 30% — ATTENTION REQUIRED
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{title}</div>
      <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '6px 0', border: '1px solid var(--border-dim)' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, c }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: c || 'var(--text-primary)', fontWeight: 600 }}>{v}</span>
    </div>
  );
}
