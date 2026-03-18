// src/components/senior-operator/SeniorOperatorDashboard.jsx
// SENIOR OPERATOR: Multi-vessel oversight + Quantum Swarm approval authority
import { useState, useEffect } from 'react';
import { routes as routesApi, alerts as alertsApi } from '../../services/api';

const MOCK_VESSELS = [
  { id:'1', name:'MV Pacific Sentinel',  callsign:'MVPS-01', type:'SHIP',     status:'ACTIVE', speed:18.4, fuel:62.4, drag:17.2, lat:35.8, lon:-140.2, heading:285 },
  { id:'2', name:'MV Atlantic Guardian', callsign:'MVAG-02', type:'SHIP',     status:'ACTIVE', speed:15.1, fuel:78.1, drag:15.8, lat:42.1, lon:-32.4,  heading:115 },
  { id:'3', name:'AS Horizon Eagle',     callsign:'ASHE-01', type:'AIRCRAFT', status:'ACTIVE', speed:480,  fuel:54.2, drag:18.4, lat:51.2, lon:12.4,   heading:088 },
  { id:'4', name:'MV Shanghai Express',  callsign:'MVSE-03', type:'SHIP',     status:'ACTIVE', speed:21.2, fuel:44.8, drag:17.0, lat:24.4, lon:155.8,  heading:060 },
];

const MOCK_SWARM = [
  { id:'sw-1', vessel:'MV Pacific Sentinel', callsign:'MVPS-01', rationale:'Optimal routing around Pacific storm cell. 340nm detour saves 8.2hr', fuel_delta:-2840, time_delta:+18, confidence:96.1, created_at: new Date(Date.now()-3600000).toISOString() },
  { id:'sw-2', vessel:'AS Horizon Eagle',    callsign:'ASHE-01', rationale:'Jet stream adjustment. New altitude FL390 gains 85kn tailwind',  fuel_delta:-6200, time_delta:-42, confidence:98.7, created_at: new Date(Date.now()-1200000).toISOString() },
];

export default function SeniorOperatorDashboard({ page }) {
  const [vessels, setVessels]         = useState(MOCK_VESSELS);
  const [swarmRequests, setSwarmReqs] = useState(MOCK_SWARM);
  const [liveAlerts, setAlerts]       = useState([]);
  const [tick, setTick]               = useState(0);

  // Simulate updates
  useEffect(() => {
    const id = setInterval(() => {
      setVessels(v => v.map(ves => ({
        ...ves,
        speed:   +(ves.speed + (Math.random()-0.5)*(ves.type==='AIRCRAFT'?8:0.3)).toFixed(1),
        fuel:    +(ves.fuel - 0.001).toFixed(3),
        drag:    +(ves.drag + (Math.random()-0.5)*0.08).toFixed(2),
        heading: ((ves.heading + (Math.random()-0.5)*0.5 + 360) % 360),
      })));
      setTick(t=>t+1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSwarm = (id, decision) => {
    setSwarmReqs(r => r.map(req => req.id===id ? { ...req, decision, reviewed: true } : req));
    routesApi.reviewSwarm(id, decision).catch(()=>{});
  };

  if (page === 'swarm')  return <SwarmApprovals requests={swarmRequests} onDecide={handleSwarm} />;
  if (page === 'routes') return <RouteControl />;
  if (page === 'alerts') return <AlertCentre />;

  return <FleetOverview vessels={vessels} swarmRequests={swarmRequests} onDecide={handleSwarm} />;
}

function FleetOverview({ vessels, swarmRequests, onDecide }) {
  const pending = swarmRequests.filter(r => !r.decision);
  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em' }}>FLEET OVERVIEW</h1>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-muted)', marginTop:3 }}>
            {vessels.filter(v=>v.status==='ACTIVE').length} vessels active · {new Date().toLocaleTimeString()} UTC
          </div>
        </div>
        {pending.length > 0 && (
          <div style={{ padding:'8px 16px', background:'rgba(255,179,71,0.12)', border:'1px solid rgba(255,179,71,0.35)', borderRadius:6 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'#ffb347' }}>
              ⚠ {pending.length} SWARM REQUEST{pending.length>1?'S':''} AWAITING APPROVAL
            </span>
          </div>
        )}
      </div>

      {/* Vessel grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginBottom:20 }}>
        {vessels.map(v => <VesselCard key={v.id} vessel={v} />)}
      </div>

      {/* Pending swarm requests */}
      {pending.length > 0 && (
        <div className="panel" style={{ padding:20 }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.9rem', letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--accent)', marginBottom:14 }}>
            ⬢ QUANTUM SWARM — PENDING APPROVAL
          </div>
          {pending.map(req => <SwarmCard key={req.id} req={req} onDecide={onDecide} />)}
        </div>
      )}
    </div>
  );
}

function VesselCard({ vessel: v }) {
  const isAir = v.type === 'AIRCRAFT';
  return (
    <div className="panel" style={{ padding:16, borderColor: v.fuel<30 ? 'rgba(255,60,90,0.35)' : 'var(--border-dim)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="pulse-dot"/>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>{v.name}</span>
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2 }}>{v.callsign} · {isAir?'AIRCRAFT':'SHIP'}</div>
        </div>
        <div className="badge badge-active">ACTIVE</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
        {[
          ['SPEED',    isAir ? v.speed+'kn' : v.speed+' kn'],
          ['FUEL',     v.fuel.toFixed(1)+'%'],
          ['DRAG ↓',  v.drag.toFixed(1)+'%'],
        ].map(([k,val]) => (
          <div key={k} style={{ textAlign:'center', padding:'6px 0' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', textTransform:'uppercase' }}>{k}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem', color:'var(--accent-text)', marginTop:2 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Heading indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <svg width={20} height={20} viewBox="0 0 20 20">
          <circle cx={10} cy={10} r={9} fill="none" stroke="var(--border-soft)" strokeWidth={0.5}/>
          <line x1={10} y1={10}
            x2={10 + 8*Math.sin(v.heading*Math.PI/180)}
            y2={10 - 8*Math.cos(v.heading*Math.PI/180)}
            stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)' }}>
          {v.heading.toFixed(0)}° · {v.lat.toFixed(2)}°N {Math.abs(v.lon).toFixed(2)}°{v.lon<0?'W':'E'}
        </span>
      </div>
    </div>
  );
}

function SwarmApprovals({ requests, onDecide }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>QUANTUM SWARM REQUESTS</h1>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {requests.map(req => <SwarmCard key={req.id} req={req} onDecide={onDecide} large />)}
        {requests.length===0 && (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.78rem' }}>
            No pending Quantum Swarm requests.
          </div>
        )}
      </div>
    </div>
  );
}

function SwarmCard({ req, onDecide, large }) {
  if (req.decision) return null;
  return (
    <div style={{ padding:16, background:'var(--bg-raised)', border:'1px solid rgba(255,179,71,0.25)', borderRadius:8, borderLeft:'3px solid var(--accent)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.95rem', color:'var(--text-primary)' }}>{req.vessel}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2 }}>{req.callsign} · {new Date(req.created_at).toLocaleTimeString()}</div>
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--status-green)' }}>
          {req.confidence}% confidence
        </div>
      </div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:12, lineHeight:1.5 }}>
        {req.rationale}
      </div>
      <div style={{ display:'flex', gap:16, marginBottom:12 }}>
        <div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)' }}>FUEL DELTA</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', color: req.fuel_delta<0?'var(--status-green)':'var(--status-red)' }}>
            {req.fuel_delta<0?'':'+'}{req.fuel_delta}L
          </div>
        </div>
        <div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)' }}>TIME DELTA</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', color: req.time_delta<0?'var(--status-green)':'var(--status-amber)' }}>
            {req.time_delta<0?'':'+' }{req.time_delta}min
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-primary btn-sm" onClick={() => onDecide(req.id, 'APPROVED')}>✓ APPROVE</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onDecide(req.id, 'REJECTED')} style={{ borderColor:'rgba(255,60,90,0.35)', color:'var(--status-red)' }}>✕ REJECT</button>
      </div>
    </div>
  );
}

function RouteControl() {
  const [routes, setRoutes] = useState([]);
  useEffect(() => { routesApi.all().then(setRoutes).catch(()=>{}); }, []);
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>ROUTE CONTROL</h1>
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Route</th><th>Vessel</th><th>Status</th><th>Distance</th><th>Savings</th><th>Action</th></tr></thead>
          <tbody>
            {routes.length ? routes.map(r => (
              <tr key={r.id}>
                <td style={{ color:'var(--text-primary)', fontWeight:600 }}>{r.origin} → {r.destination}</td>
                <td>{r.vessel_name}</td>
                <td><div className={`badge badge-${r.status==='ACTIVE'?'active':r.status==='PENDING'?'pending':'idle'}`}>{r.status}</div></td>
                <td>{r.distance_nm ? r.distance_nm+' nm' : '—'}</td>
                <td style={{ color:'var(--status-green)' }}>{r.fuel_savings_eur ? `€${(+r.fuel_savings_eur).toLocaleString()}` : '—'}</td>
                <td>
                  {r.status==='PENDING' && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-primary btn-sm" onClick={()=>routesApi.updateStatus(r.id,'APPROVED').catch(()=>{})}>Approve</button>
                      <button className="btn btn-ghost btn-sm" style={{color:'var(--status-red)'}}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No routes found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertCentre() {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => { alertsApi.all().then(setAlerts).catch(()=>{}); }, []);
  const ack = (id) => {
    alertsApi.acknowledge(id).then(()=>setAlerts(a=>a.map(x=>x.id===id?{...x,is_acknowledged:true}:x))).catch(()=>{});
  };
  const unacked = alerts.filter(a=>!a.is_acknowledged);
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>
        ALERT CENTRE <span style={{ color:'var(--status-red)', fontSize:'1rem' }}>{unacked.length > 0 ? `(${unacked.length})` : ''}</span>
      </h1>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {unacked.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:'var(--status-green)', fontFamily:'var(--font-mono)', fontSize:'0.78rem' }}>● ALL CLEAR — NO ACTIVE ALERTS</div>
        )}
        {unacked.map(a => (
          <div key={a.id} style={{ padding:14, background:'var(--bg-raised)', border:`1px solid ${a.severity==='CRITICAL'?'rgba(255,60,90,0.35)':a.severity==='WARNING'?'rgba(255,176,32,0.3)':'var(--border-dim)'}`, borderRadius:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                <div className={`badge badge-${a.severity==='CRITICAL'?'critical':a.severity==='WARNING'?'warning':'active'}`}>{a.severity}</div>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.9rem' }}>{a.title}</span>
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)' }}>{a.message} · {a.vessel_name}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => ack(a.id)}>ACK</button>
          </div>
        ))}
      </div>
    </div>
  );
}
