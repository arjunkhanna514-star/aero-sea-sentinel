// src/components/operator/OperatorDashboard.jsx
// OPERATOR: Tactical cockpit — dense real-time data, HOTAS-style layout
import { useState, useEffect } from 'react';
import { vessels as vesselsApi, telemetry as telApi } from '../../services/api';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

// Simulated live data mutation (for demo when no backend)
const MOCK = {
  vessel_name: 'MV Pacific Sentinel', callsign:'MVPS-01', type:'SHIP',
  latitude:35.8, longitude:-140.2, heading_deg:285, speed_knots:18.4,
  fuel_level_pct:62.4, fuel_burn_rate_lph:4820, drag_reduction_pct:17.2,
  drag_coefficient:0.000842, smart_skin_active_zones:1840, micro_adjustment_count:14823,
  quantum_temp_celsius:3.7, quantum_cpu_load_pct:68.4, quantum_coherence_pct:99.2,
  lidar_range_m:12400, lidar_object_count:3, lidar_visibility_pct:94.8,
  wind_speed_ms:12.4, jet_stream_velocity_ms:0, wave_height_m:1.8,
  co2_kg_per_hour:22.4,
};

export default function OperatorDashboard({ page }) {
  const [data, setData]       = useState(MOCK);
  const [fuelHistory, setFH]  = useState([]);
  const [dragHistory, setDH]  = useState([]);
  const [tick, setTick]       = useState(0);

  // Simulate live updates every second
  useEffect(() => {
    const id = setInterval(() => {
      setData(d => ({
        ...d,
        speed_knots:          +(d.speed_knots + (Math.random()-0.5)*0.4).toFixed(1),
        fuel_burn_rate_lph:   Math.round(d.fuel_burn_rate_lph + (Math.random()-0.5)*60),
        drag_reduction_pct:   +(d.drag_reduction_pct + (Math.random()-0.5)*0.2).toFixed(2),
        quantum_temp_celsius: +(d.quantum_temp_celsius + (Math.random()-0.5)*0.05).toFixed(2),
        quantum_cpu_load_pct: +(d.quantum_cpu_load_pct + (Math.random()-0.5)*2).toFixed(1),
        lidar_object_count:   Math.max(0, d.lidar_object_count + (Math.random()<0.1 ? (Math.random()<0.5?1:-1) : 0)),
        micro_adjustment_count: d.micro_adjustment_count + Math.floor(Math.random()*4),
        wave_height_m: +(d.wave_height_m + (Math.random()-0.5)*0.05).toFixed(2),
      }));
      setTick(t => t+1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setFH(h => [...h.slice(-40), { t: new Date().toLocaleTimeString(), v: data.fuel_burn_rate_lph }]);
    setDH(h => [...h.slice(-40), { t: new Date().toLocaleTimeString(), v: data.drag_reduction_pct }]);
  }, [tick]);

  if (page === 'compass') return <QuantumCompass data={data} />;
  if (page === 'lidar')   return <EagleEyeLiDAR data={data} />;
  if (page === 'skin')    return <SmartSkinPanel data={data} />;
  return <Cockpit data={data} fuelHistory={fuelHistory} dragHistory={dragHistory} />;
}

// ─── Main Cockpit ────────────────────────────────────────────
function Cockpit({ data, fuelHistory, dragHistory }) {
  return (
    <div style={{ padding:20, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'auto auto auto', gap:12 }}>
      {/* Top bar */}
      <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'var(--bg-panel)', border:'1px solid var(--border-dim)', borderRadius:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div className="pulse-dot"/>
          <div>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', letterSpacing:'0.06em' }}>{data.vessel_name}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)', marginLeft:12 }}>{data.callsign}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          {[
            ['HDG', data.heading_deg+'°'],
            ['LAT', data.latitude.toFixed(3)+'°N'],
            ['LON', Math.abs(data.longitude).toFixed(3)+'°W'],
          ].map(([k,v]) => (
            <div key={k} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase' }}>{k}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', color:'var(--accent-text)' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--status-green)' }}>
          {new Date().toLocaleTimeString()} UTC
        </div>
      </div>

      {/* Speed gauge */}
      <GaugeCard label="SPEED" value={data.speed_knots} unit="kn" max={25} color="var(--accent)" />
      {/* Fuel */}
      <GaugeCard label="FUEL" value={data.fuel_level_pct} unit="%" max={100} color="var(--status-amber)"
        warning={data.fuel_level_pct < 30} />
      {/* Drag reduction */}
      <GaugeCard label="DRAG ↓" value={data.drag_reduction_pct} unit="%" max={25} color="var(--status-green)" />

      {/* Fuel burn chart */}
      <div className="chart-container" style={{ gridColumn:'1/3' }}>
        <div className="chart-title">FUEL BURN RATE — L/HR</div>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={fuelHistory}>
            <defs>
              <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ffb020" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ffb020" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={['auto','auto']} tick={{ fill:'#4a6080', fontSize:9, fontFamily:'IBM Plex Mono' }} width={50}/>
            <Tooltip contentStyle={{ background:'#0b1120', border:'1px solid #1a2840', fontFamily:'IBM Plex Mono', fontSize:11 }} />
            <Area type="monotone" dataKey="v" stroke="#ffb020" fill="url(#fg)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quantum status */}
      <div className="panel" style={{ padding:16 }}>
        <div className="chart-title">QUANTUM PROCESSOR</div>
        {[
          ['TEMP',      data.quantum_temp_celsius+'°K',  '#3db8ff'],
          ['CPU LOAD',  data.quantum_cpu_load_pct+'%',   '#9b6dff'],
          ['COHERENCE', data.quantum_coherence_pct+'%',  '#00e5a0'],
        ].map(([k,v,c]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase' }}>{k}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', color:c, fontWeight:600 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop:8, padding:'6px 10px', background:'rgba(0,229,160,0.08)', borderRadius:4, border:'1px solid rgba(0,229,160,0.2)' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--status-green)' }}>● QUANTUM LOCK STABLE</span>
        </div>
      </div>

      {/* Smart Skin summary */}
      <div className="panel" style={{ padding:16, gridColumn:'1/3' }}>
        <div className="chart-title">SMART SKIN MICRO-ADJUSTMENTS</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {[
            ['ACTIVE ZONES', data.smart_skin_active_zones, ''],
            ['ADJUSTMENTS', data.micro_adjustment_count.toLocaleString(), 'total'],
            ['DRAG COEFF',  data.drag_coefficient.toFixed(6), ''],
            ['REDUCTION',   data.drag_reduction_pct+'%', '↓'],
          ].map(([k,v,u]) => (
            <div key={k} style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.5rem', color:'var(--accent-text)' }}>{v}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', marginTop:3 }}>{k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Eagle Eye summary */}
      <div className="panel" style={{ padding:16 }}>
        <div className="chart-title">EAGLE EYE LIDAR</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <LiveBar label="RANGE" value={data.lidar_range_m} max={20000} unit="m" color="var(--accent)"/>
          <LiveBar label="VISIBILITY" value={data.lidar_visibility_pct} max={100} unit="%" color="var(--status-green)"/>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)' }}>OBJECTS DETECTED</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', color: data.lidar_object_count > 0 ? 'var(--status-amber)' : 'var(--status-green)' }}>
              {data.lidar_object_count}
            </span>
          </div>
        </div>
      </div>

      {/* Weather row */}
      <div className="panel" style={{ padding:16 }}>
        <div className="chart-title">ENVIRONMENT</div>
        {[
          ['WIND',   data.wind_speed_ms+' m/s'],
          ['WAVES',  data.wave_height_m+'m'],
          ['CO₂/H',  data.co2_kg_per_hour+' kg'],
        ].map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)' }}>{k}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', color:'var(--text-primary)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaugeCard({ label, value, unit, max, color, warning }) {
  const pct = Math.min((value/max)*100, 100);
  return (
    <div className="metric-card" style={{ borderColor: warning ? 'rgba(255,60,90,0.4)' : undefined }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'2.2rem', color, lineHeight:1 }}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        <span style={{ fontSize:'0.9rem', marginLeft:4, opacity:0.7 }}>{unit}</span>
      </div>
      <div style={{ marginTop:10, height:3, background:'var(--bg-void)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:pct+'%', background:color, borderRadius:2, transition:'width 0.5s var(--ease-smooth)' }}/>
      </div>
    </div>
  );
}

function LiveBar({ label, value, max, unit, color }) {
  const pct = Math.min((value/max)*100, 100);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase' }}>{label}</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color }}>{value.toLocaleString()} {unit}</span>
      </div>
      <div style={{ height:3, background:'var(--bg-void)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:pct+'%', background:color, transition:'width 0.8s var(--ease-smooth)', borderRadius:2 }}/>
      </div>
    </div>
  );
}

// ─── Quantum Compass page ────────────────────────────────────
function QuantumCompass({ data }) {
  const [angle, setAngle] = useState(data.heading_deg);
  useEffect(() => {
    const id = setInterval(() => setAngle(a => (a + 0.08) % 360), 50);
    return () => clearInterval(id);
  }, []);
  const r2d = (r) => r * (180/Math.PI);

  return (
    <div style={{ padding:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      <div className="panel" style={{ padding:24, display:'flex', flexDirection:'column', alignItems:'center', gridRow:'1/3' }}>
        <div className="chart-title" style={{ width:'100%' }}>QUANTUM COMPASS — BEARING {angle.toFixed(1)}°</div>
        {/* SVG compass rose */}
        <svg width={280} height={280} viewBox="0 0 280 280">
          <circle cx={140} cy={140} r={130} fill="none" stroke="var(--border-dim)" strokeWidth={1}/>
          <circle cx={140} cy={140} r={110} fill="none" stroke="var(--accent-border)" strokeWidth={0.5}/>
          {/* Tick marks */}
          {Array.from({length:72}).map((_,i) => {
            const a = (i*5)*Math.PI/180;
            const r1 = i%18===0 ? 95 : i%6===0 ? 105 : 112;
            return <line key={i}
              x1={140+130*Math.sin(a)} y1={140-130*Math.cos(a)}
              x2={140+r1*Math.sin(a)} y2={140-r1*Math.cos(a)}
              stroke={i%18===0?"var(--accent)":"var(--border-soft)"} strokeWidth={i%18===0?1.5:0.5}
            />;
          })}
          {/* Cardinal labels */}
          {[['N',140,22],['E',258,144],['S',140,264],['W',18,144]].map(([l,x,y]) => (
            <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontFamily="Rajdhani" fontWeight="700" fontSize="14"
              fill={l==='N'?"var(--status-red)":"var(--accent-text)"}>{l}</text>
          ))}
          {/* Rotating needle group */}
          <g transform={`rotate(${angle}, 140, 140)`}>
            <polygon points="140,30 136,140 144,140" fill="var(--status-red)" opacity={0.9}/>
            <polygon points="140,250 136,140 144,140" fill="var(--text-muted)" opacity={0.6}/>
          </g>
          {/* Center */}
          <circle cx={140} cy={140} r={8} fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth={1.5}/>
          <circle cx={140} cy={140} r={3} fill="var(--accent)"/>
          {/* Quantum rings */}
          {[90,75,60].map((r,i) => (
            <circle key={i} cx={140} cy={140} r={r} fill="none"
              stroke="var(--accent)" strokeWidth={0.3} opacity={0.2+i*0.1}
              strokeDasharray={`${2+i} ${4-i}`}
              style={{animation:`rotate${i%2===0?'':'Rev'} ${8+i*3}s linear infinite`, transformOrigin:'140px 140px'}}
            />
          ))}
        </svg>
        <style>{`
          @keyframes rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes rotateRev { from{transform:rotate(360deg)} to{transform:rotate(0deg)} }
        `}</style>

        <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%' }}>
          {[
            ['BEARING', angle.toFixed(2)+'°'],
            ['SPEED',   data.speed_knots+' kn'],
            ['LAT',     data.latitude.toFixed(4)+'°N'],
            ['LON',     Math.abs(data.longitude).toFixed(4)+'°W'],
          ].map(([k,v]) => (
            <div key={k} style={{ padding:'8px 12px', background:'var(--bg-raised)', borderRadius:4, border:'1px solid var(--border-dim)' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-muted)' }}>{k}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', color:'var(--accent-text)', fontWeight:600 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quantum stats */}
      <div className="panel" style={{ padding:20 }}>
        <div className="chart-title">QUANTUM PROCESSOR STATUS</div>
        {[
          { k:'Coherence',    v:data.quantum_coherence_pct+'%',  bar:data.quantum_coherence_pct, c:'#00e5a0' },
          { k:'CPU Load',     v:data.quantum_cpu_load_pct+'%',   bar:data.quantum_cpu_load_pct,  c:'#9b6dff' },
          { k:'Temperature',  v:data.quantum_temp_celsius+'°K',  bar:(data.quantum_temp_celsius/10)*100, c:'#3db8ff' },
        ].map(m => (
          <div key={m.k} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase' }}>{m.k}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', color:m.c, fontWeight:600 }}>{m.v}</span>
            </div>
            <div style={{ height:4, background:'var(--bg-void)', borderRadius:2 }}>
              <div style={{ height:'100%', width:m.bar+'%', background:m.c, borderRadius:2, boxShadow:`0 0 8px ${m.c}55`, transition:'width 1s' }}/>
            </div>
          </div>
        ))}
        <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(0,229,160,0.06)', borderRadius:6, border:'1px solid rgba(0,229,160,0.15)' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--status-green)', lineHeight:1.6 }}>
            ● QUANTUM SWARM SYNC ACTIVE<br/>
            ● ROUTE OPTIMISATION: ENABLED<br/>
            ● NEXT WAYPOINT: 48.2nm
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding:20 }}>
        <div className="chart-title">ROUTE OPTIMISATION</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:2 }}>
          <div>Origin: <span style={{color:'var(--accent-text)'}}>Shanghai, CN</span></div>
          <div>Destination: <span style={{color:'var(--accent-text)'}}>Los Angeles, CA</span></div>
          <div>Distance: <span style={{color:'var(--accent-text)'}}>5,480 nm</span></div>
          <div>ETA: <span style={{color:'var(--accent-text)'}}>12d 14h 22m</span></div>
          <div>Swarm Confidence: <span style={{color:'var(--status-green)'}}>97.4%</span></div>
          <div>Fuel Savings: <span style={{color:'var(--status-green)'}}>€41,250/mo</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── Eagle Eye LiDAR page ────────────────────────────────────
function EagleEyeLiDAR({ data }) {
  const [sweep, setSweep] = useState(0);
  const [objects, setObjects] = useState([
    { angle: 45, dist: 0.55, type:'VESSEL', id:'MVAG-02' },
    { angle: 210, dist: 0.78, type:'DEBRIS', id:'UNK-01' },
    { angle: 320, dist: 0.3, type:'BUOY', id:'BUY-44' },
  ]);

  useEffect(() => {
    const id = setInterval(() => setSweep(s => (s + 3) % 360), 30);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding:24, display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
      {/* Radar display */}
      <div className="panel" style={{ padding:24, display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div className="chart-title" style={{ width:'100%' }}>EAGLE EYE LiDAR — 360° SCAN</div>
        <svg width={320} height={320} viewBox="0 0 320 320" style={{ marginTop:8 }}>
          {/* Grid rings */}
          {[160,120,80,40].map(r => (
            <circle key={r} cx={160} cy={160} r={r} fill="none" stroke="rgba(0,229,160,0.1)" strokeWidth={0.8}/>
          ))}
          {/* Cross-hairs */}
          <line x1={160} y1={0} x2={160} y2={320} stroke="rgba(0,229,160,0.08)" strokeWidth={0.5}/>
          <line x1={0} y1={160} x2={320} y2={160} stroke="rgba(0,229,160,0.08)" strokeWidth={0.5}/>
          {/* Sweep */}
          <defs>
            <radialGradient id="sweep">
              <stop offset="0%" stopColor="#00e5a0" stopOpacity={0.7}/>
              <stop offset="100%" stopColor="#00e5a0" stopOpacity={0}/>
            </radialGradient>
          </defs>
          <path
            d={sweepPath(160, 160, 155, sweep)}
            fill="url(#sweep)"
          />
          {/* Objects */}
          {objects.map(o => {
            const rad = (o.angle - 90) * Math.PI/180;
            const x = 160 + o.dist * 155 * Math.cos(rad);
            const y = 160 + o.dist * 155 * Math.sin(rad);
            return (
              <g key={o.id}>
                <circle cx={x} cy={y} r={5} fill={o.type==='VESSEL'?'#3db8ff':o.type==='DEBRIS'?'#ff3c5a':'#ffb020'}/>
                <circle cx={x} cy={y} r={9} fill="none"
                  stroke={o.type==='VESSEL'?'#3db8ff':o.type==='DEBRIS'?'#ff3c5a':'#ffb020'}
                  strokeWidth={0.8} opacity={0.5}/>
                <text x={x+8} y={y-6} fontFamily="IBM Plex Mono" fontSize="8" fill="#8fa3bc">{o.id}</text>
              </g>
            );
          })}
          {/* Own vessel */}
          <circle cx={160} cy={160} r={6} fill="var(--accent)" opacity={0.9}/>
          <circle cx={160} cy={160} r={12} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.4}/>
        </svg>
        <div style={{ marginTop:12, display:'flex', gap:16 }}>
          {[['#3db8ff','VESSEL'],['#ff3c5a','DEBRIS'],['#ffb020','BUOY']].map(([c,l]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }}/>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Object list + stats */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div className="panel" style={{ padding:16 }}>
          <div className="chart-title">DETECTED OBJECTS</div>
          {objects.map(o => (
            <div key={o.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-dim)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-primary)', fontWeight:600 }}>{o.id}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2 }}>{o.type} · {o.angle}° · {(o.dist*12.4).toFixed(1)}nm</div>
              </div>
              <div className={`badge badge-${o.type==='VESSEL'?'active':o.type==='DEBRIS'?'critical':'warning'}`}>{o.type}</div>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding:16 }}>
          <div className="chart-title">SENSOR STATUS</div>
          {[
            ['RANGE',        (data.lidar_range_m/1000).toFixed(1)+'km',    'var(--accent)'],
            ['VISIBILITY',   data.lidar_visibility_pct+'%',                 'var(--status-green)'],
            ['SCAN RATE',    '360°/2s',                                     'var(--text-primary)'],
            ['WAVE HT',      data.wave_height_m+'m',                        'var(--status-blue)'],
          ].map(([k,v,c]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase' }}>{k}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', color:c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function sweepPath(cx, cy, r, angleDeg) {
  const start = ((angleDeg - 60) * Math.PI) / 180;
  const end   = (angleDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`;
}

// ─── Smart Skin panel ────────────────────────────────────────
function SmartSkinPanel({ data }) {
  const [zones, setZones] = useState(() =>
    Array.from({length:48}).map((_,i) => ({ id:i, active:Math.random()>0.15, strength:Math.random() }))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setZones(z => z.map(zone => ({
        ...zone,
        strength: Math.max(0.05, Math.min(1, zone.strength + (Math.random()-0.5)*0.15))
      })));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding:24, display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:20 }}>
      <div className="panel" style={{ padding:20 }}>
        <div className="chart-title">SMART SKIN MICRO-ACTUATOR GRID</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:3, marginTop:8 }}>
          {zones.map(z => (
            <div key={z.id} title={`Zone ${z.id}: ${(z.strength*100).toFixed(0)}%`}
              style={{
                aspectRatio:'1', borderRadius:2,
                background: z.active
                  ? `rgba(0,229,160,${0.15+z.strength*0.65})`
                  : 'var(--bg-raised)',
                border: `1px solid ${z.active ? `rgba(0,229,160,${0.3+z.strength*0.4})` : 'var(--border-dim)'}`,
                transition:'all 1.2s var(--ease-smooth)',
                boxShadow: z.active && z.strength > 0.8 ? '0 0 4px rgba(0,229,160,0.4)' : 'none',
              }}
            />
          ))}
        </div>
        <div style={{ marginTop:14, display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:'rgba(0,229,160,0.7)', border:'1px solid rgba(0,229,160,0.5)' }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>ACTIVE</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:'var(--bg-raised)', border:'1px solid var(--border-dim)' }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>STANDBY</span>
          </div>
          <div style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--accent-text)' }}>
            {zones.filter(z=>z.active).length}/48 zones active
          </div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {[
          { k:'ACTIVE PANELS',   v: data.smart_skin_active_zones.toLocaleString(), c:'var(--accent)' },
          { k:'MICRO-ADJ TODAY', v: data.micro_adjustment_count.toLocaleString(), c:'var(--text-primary)' },
          { k:'DRAG REDUCTION',  v: data.drag_reduction_pct+'%',                  c:'var(--status-green)' },
          { k:'DRAG COEFF',      v: data.drag_coefficient.toFixed(6),             c:'var(--text-secondary)' },
        ].map(m => (
          <div key={m.k} className="metric-card">
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:4 }}>{m.k}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.8rem', color:m.c }}>{m.v}</div>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ marginTop:4 }}>
          ⬡ MANUAL OVERRIDE
        </button>
      </div>
    </div>
  );
}
