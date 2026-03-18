// src/components/fleet-manager/FleetManagerDashboard.jsx
import { useState, useEffect } from 'react';
import { financials as finApi, vessels as vesselApi, routes as routesApi, admin } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import FleetMap from './FleetMap';
import AdminUserManagement from '../admin/AdminUserManagement';

const fmt = (n) => `€${(+n||0).toLocaleString('en-EU',{maximumFractionDigits:0})}`;

export function FleetManagerDashboard({ page }) {
  const [kpis,    setKpis]    = useState(null);
  const [savings, setSavings] = useState(null);
  const [vessels, setVessels] = useState([]);
  const [routes,  setRoutes]  = useState([]);

  useEffect(() => {
    Promise.all([finApi.kpis(), finApi.savings(), vesselApi.all(), routesApi.all({ status:'PENDING' })])
      .then(([k,s,v,r]) => { setKpis(k); setSavings(s); setVessels(v); setRoutes(r); })
      .catch(()=>{});
  }, []);

  const pending = routes.filter(r=>r.status==='PENDING');

  const barData = [
    { name:'Ship Savings',     target:500000, actual: +(savings?.total_ship_savings_eur||498200) },
    { name:'Aircraft Savings', target:1200000, actual: +(savings?.total_aircraft_savings_eur||1228800) },
  ];

  if (page === 'map')          return <FleetMap />;
  if (page === 'routes')       return <RouteApprovals routes={routes} setRoutes={setRoutes} />;
  if (page === 'profitability') return <Profitability savings={savings} kpis={kpis} />;
  if (page === 'vessels')      return <VesselRegistry vessels={vessels} />;

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.7rem', letterSpacing:'0.06em' }}>FLEET MANAGEMENT</h1>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-muted)', marginTop:4 }}>
            {kpis?.active_vessels || 4} active vessels · fleet-wide profitability view
          </div>
        </div>
        {pending.length > 0 && (
          <div style={{ padding:'8px 16px', background:'rgba(0,201,255,0.1)', border:'1px solid rgba(0,201,255,0.3)', borderRadius:6 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'#00c9ff' }}>
              {pending.length} route{pending.length>1?'s':''} awaiting approval
            </span>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          ['FLEET SAVINGS (30d)',   fmt(savings?.total_fuel_savings_eur || 498200),     '#00c9ff'],
          ['SHIP SAVINGS',          fmt(savings?.total_ship_savings_eur || 250400),      '#00c9ff'],
          ['AIRCRAFT SAVINGS',      fmt(savings?.total_aircraft_savings_eur || 247800),  '#7ee8a2'],
          ['ROUTES OPTIMISED',      kpis?.routes_optimised || 847,                       'var(--accent)'],
        ].map(([k,v,c]) => (
          <div key={k} className="metric-card">
            <div className="metric-label">{k}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div className="chart-container">
          <div className="chart-title">SAVINGS vs ANNUAL TARGETS</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="name" tick={{fill:'#4a6080',fontSize:9,fontFamily:'IBM Plex Mono'}}/>
              <YAxis tick={{fill:'#4a6080',fontSize:9,fontFamily:'IBM Plex Mono'}} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} width={55}/>
              <Tooltip contentStyle={{background:'#0b1120',border:'1px solid #1a2840',fontFamily:'IBM Plex Mono',fontSize:11}} formatter={v=>[`€${v.toLocaleString()}`,'']}/>
              <Bar dataKey="target" name="Target" fill="rgba(255,255,255,0.08)" radius={[3,3,0,0]}/>
              <Bar dataKey="actual" name="Actual" radius={[3,3,0,0]}>
                {barData.map((e,i) => <Cell key={i} fill={e.actual>=e.target ? '#7ee8a2' : '#00c9ff'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pending route approvals */}
        <div className="panel" style={{ padding:16 }}>
          <div className="chart-title">PENDING ROUTE APPROVALS</div>
          {pending.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'var(--status-green)', fontFamily:'var(--font-mono)', fontSize:'0.72rem' }}>● All routes approved</div>
          ) : pending.map(r => (
            <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-dim)' }}>
              <div style={{ fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'var(--text-primary)', fontWeight:600, marginBottom:4 }}>
                {r.origin} → {r.destination}
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', marginBottom:8 }}>
                {r.vessel_name} · {r.distance_nm ? r.distance_nm+'nm' : '—'}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" onClick={()=>routesApi.updateStatus(r.id,'APPROVED').then(()=>setRoutes(x=>x.map(rx=>rx.id===r.id?{...rx,status:'APPROVED'}:rx))).catch(()=>{})}>
                  Approve
                </button>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--status-red)'}} onClick={()=>routesApi.updateStatus(r.id,'REJECTED').then(()=>setRoutes(x=>x.map(rx=>rx.id===r.id?{...rx,status:'REJECTED'}:rx))).catch(()=>{})}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vessel status */}
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border-dim)' }}>
          <div className="chart-title" style={{ marginBottom:0 }}>VESSEL REGISTRY — LIVE STATUS</div>
        </div>
        <table className="data-table">
          <thead><tr><th>Vessel</th><th>Type</th><th>Status</th><th>Smart Skin</th><th>Quantum</th></tr></thead>
          <tbody>
            {vessels.map(v => (
              <tr key={v.id}>
                <td><div style={{ fontWeight:600, color:'var(--text-primary)' }}>{v.name}</div><div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{v.callsign}</div></td>
                <td>{v.type}</td>
                <td><div className={`badge badge-${v.status==='ACTIVE'?'active':'idle'}`}>{v.status}</div></td>
                <td style={{ color: v.smart_skin_enabled?'var(--status-green)':'var(--text-muted)' }}>
                  {v.smart_skin_enabled ? `${v.smart_skin_panels} panels` : 'Disabled'}
                </td>
                <td style={{ color: v.quantum_processor_id?'var(--accent-text)':'var(--text-muted)' }}>
                  {v.quantum_processor_id || '—'}
                </td>
              </tr>
            ))}
            {vessels.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RouteApprovals({ routes, setRoutes }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>ROUTE APPROVALS</h1>
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Route</th><th>Vessel</th><th>Status</th><th>Swarm</th><th>Savings</th><th>Actions</th></tr></thead>
          <tbody>
            {routes.map(r => (
              <tr key={r.id}>
                <td><div style={{color:'var(--text-primary)',fontWeight:600}}>{r.origin}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>→ {r.destination}</div></td>
                <td>{r.vessel_name}</td>
                <td><div className={`badge badge-${r.status==='ACTIVE'?'active':r.status==='PENDING'?'pending':r.status==='APPROVED'?'active':'idle'}`}>{r.status}</div></td>
                <td style={{ color: r.is_quantum_swarm?'var(--accent-text)':'var(--text-dim)' }}>
                  {r.is_quantum_swarm ? `${r.swarm_confidence}%` : '—'}
                </td>
                <td style={{color:'var(--status-green)'}}>{r.fuel_savings_eur ? `€${(+r.fuel_savings_eur).toLocaleString()}` : '—'}</td>
                <td>
                  {r.status==='PENDING' && <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>routesApi.updateStatus(r.id,'APPROVED').then(()=>setRoutes(x=>x.map(rx=>rx.id===r.id?{...rx,status:'APPROVED'}:rx))).catch(()=>{})}>✓</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--status-red)'}} onClick={()=>routesApi.updateStatus(r.id,'REJECTED').then(()=>setRoutes(x=>x.map(rx=>rx.id===r.id?{...rx,status:'REJECTED'}:rx))).catch(()=>{})}>✕</button>
                  </div>}
                </td>
              </tr>
            ))}
            {routes.length===0 && <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>No routes found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Profitability({ savings, kpis }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>FLEET PROFITABILITY</h1>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        {[
          { k:'Ship Annual Target',     v:'€500,000/vessel', sub:'17.2% avg drag reduction', c:'#00c9ff' },
          { k:'Aircraft Annual Target', v:'€1,200,000/unit', sub:'18.4% avg drag reduction', c:'#7ee8a2' },
          { k:'Monthly Fleet Total',    v:fmt(kpis?.fleet_fuel_savings_eur || 498200), sub:'vs €540k target', c:'var(--accent)' },
        ].map(m => (
          <div key={m.k} className="metric-card">
            <div className="metric-label">{m.k}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.4rem', color:m.c, marginTop:4 }}>{m.v}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)', marginTop:4 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding:20 }}>
        <div className="chart-title">CASE STUDY BREAKDOWN</div>
        {[
          { route:'Shanghai → LA', type:'SHIP',     monthly:41250,  annual:495000,  target:500000,  drag:17.2 },
          { route:'Intercont. Cargo',type:'AIRCRAFT',monthly:102400, annual:1228800, target:1200000, drag:18.4 },
        ].map(c => (
          <div key={c.route} style={{ marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <div>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.92rem' }}>{c.route}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)', marginLeft:10 }}>{c.type}</span>
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem', color:'var(--status-green)' }}>
                €{c.monthly.toLocaleString()}/month · €{c.annual.toLocaleString()}/year
              </div>
            </div>
            <div style={{ height:6, background:'var(--bg-void)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:Math.min((c.annual/c.target)*100,105)+'%', background:'var(--accent)', borderRadius:3, boxShadow:'0 0 8px var(--accent-glow)' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-dim)' }}>{c.drag}% drag reduction</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--status-green)' }}>{((c.annual/c.target)*100).toFixed(1)}% of target</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VesselRegistry({ vessels }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>VESSEL REGISTRY</h1>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
        {vessels.map(v => (
          <div key={v.id} className="panel" style={{ padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>{v.name}</div>
              <div className={`badge badge-${v.status==='ACTIVE'?'active':'idle'}`}>{v.status}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontFamily:'var(--font-mono)', fontSize:'0.72rem' }}>
              {[
                ['Callsign', v.callsign],
                ['Type',     v.type],
                ['Smart Skin', v.smart_skin_enabled ? v.smart_skin_panels+' panels' : 'Disabled'],
                ['Quantum Proc', v.quantum_processor_id || 'None'],
              ].map(([k,val]) => (
                <div key={k} style={{ padding:'6px 10px', background:'var(--bg-raised)', borderRadius:4 }}>
                  <div style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', marginBottom:2 }}>{k}</div>
                  <div style={{ color:'var(--text-secondary)' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {vessels.length===0 && <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>Loading vessels...</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
export function AdminDashboard({ page }) {
  const [users,   setUsers]   = useState([]);
  const [nodes,   setNodes]   = useState([]);
  const [audits,  setAudits]  = useState([]);

  useEffect(() => {
    admin.users().then(setUsers).catch(()=>{});
    admin.nodes().then(setNodes).catch(()=>{});
    admin.auditLogs().then(setAudits).catch(()=>{});
  }, []);

  if (page === 'users')     return <AdminUserManagement users={users} setUsers={setUsers} />;
  if (page === 'nodes')     return <ServerNodes nodes={nodes} />;
  if (page === 'audit')     return <AuditLog audits={audits} />;
  if (page === 'overrides') return <Overrides />;

  return <AdminOverview users={users} nodes={nodes} />;
}

function AdminOverview({ users, nodes }) {
  const ROLE_COLORS = { ADMIN:'#ff4d6d', FLEET_MANAGER:'#00c9ff', ANALYST:'#7ee8a2', SENIOR_OPERATOR:'#ffb347', OPERATOR:'#00e5a0' };
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.7rem', letterSpacing:'0.06em', marginBottom:20, color:'var(--accent)' }}>
        SYSTEM ADMINISTRATION
      </h1>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          ['TOTAL USERS',      users.length || '—',                    '#ff4d6d'],
          ['SERVER NODES',     nodes.length || '—',                    '#00c9ff'],
          ['NODES ONLINE',     nodes.filter(n=>n.is_online).length || '—', '#7ee8a2'],
          ['ACTIVE SESSIONS',  users.filter(u=>u.is_active).length || '—', 'var(--accent)'],
        ].map(([k,v,c]) => (
          <div key={k} className="metric-card">
            <div className="metric-label">{k}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'2rem', color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="panel" style={{ padding:20 }}>
          <div className="chart-title">USERS BY ROLE</div>
          {Object.entries(ROLE_COLORS).map(([role, color]) => {
            const count = users.filter(u=>u.role===role).length;
            return (
              <div key={role} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-secondary)', textTransform:'uppercase' }}>{role}</span>
                </div>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', color }}>{count}</span>
              </div>
            );
          })}
        </div>

        <div className="panel" style={{ padding:20 }}>
          <div className="chart-title">SERVER NODES</div>
          {nodes.map(n => (
            <div key={n.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-primary)' }}>{n.name}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-dim)' }}>{n.node_type} · {n.region}</div>
              </div>
              <div className={`badge badge-${n.is_online?'active':'critical'}`}>{n.is_online?'ONLINE':'OFFLINE'}</div>
            </div>
          ))}
          {nodes.length===0 && <div style={{color:'var(--text-muted)',fontFamily:'var(--font-mono)',fontSize:'0.72rem'}}>Loading nodes...</div>}
        </div>
      </div>
    </div>
  );
}

function UserManagement({ users }) {
  const ROLE_COLORS = { ADMIN:'#ff4d6d', FLEET_MANAGER:'#00c9ff', ANALYST:'#7ee8a2', SENIOR_OPERATOR:'#ffb347', OPERATOR:'#00e5a0' };
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>USER MANAGEMENT</h1>
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ color:'var(--text-primary)', fontWeight:600 }}>{u.full_name}</td>
                <td style={{ color:'var(--text-secondary)' }}>{u.email}</td>
                <td><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:ROLE_COLORS[u.role]||'var(--text-muted)', textTransform:'uppercase' }}>{u.role}</span></td>
                <td><div className={`badge badge-${u.is_active?'active':'idle'}`}>{u.is_active?'ACTIVE':'INACTIVE'}</div></td>
                <td style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
              </tr>
            ))}
            {users.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServerNodes({ nodes }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>SERVER NODES</h1>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
        {nodes.map(n => (
          <div key={n.id} className="panel" style={{ padding:18, borderColor: !n.is_online?'rgba(255,60,90,0.3)':'var(--border-dim)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>{n.name}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2 }}>{n.node_type} · {n.region} · {n.ip_address}</div>
              </div>
              <div className={`badge badge-${n.is_online?'active':'critical'}`}>{n.is_online?'ONLINE':'OFFLINE'}</div>
            </div>
            {[['CPU',n.cpu_load_pct||0,'#9b6dff'],['MEMORY',n.memory_used_pct||0,'#3db8ff'],['DISK',n.disk_used_pct||0,'#ffb347']].map(([k,v,c]) => (
              <div key={k} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase' }}>{k}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:c }}>{(+v).toFixed(1)}%</span>
                </div>
                <div style={{ height:3, background:'var(--bg-void)', borderRadius:2 }}>
                  <div style={{ height:'100%', width:v+'%', background:c, borderRadius:2 }}/>
                </div>
              </div>
            ))}
          </div>
        ))}
        {nodes.length===0 && <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>Loading nodes...</div>}
      </div>
    </div>
  );
}

function AuditLog({ audits }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>AUDIT LOG</h1>
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Resource</th><th>IP</th></tr></thead>
          <tbody>
            {audits.map(a => (
              <tr key={a.id}>
                <td style={{ whiteSpace:'nowrap' }}>{new Date(a.created_at).toLocaleString()}</td>
                <td style={{ color:'var(--text-primary)' }}>{a.full_name||'—'}</td>
                <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)' }}>{a.role||'—'}</td>
                <td><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--accent-text)' }}>{a.action}</span></td>
                <td style={{ color:'var(--text-secondary)' }}>{a.resource_type||'—'}</td>
                <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)' }}>{a.ip_address||'—'}</td>
              </tr>
            ))}
            {audits.length===0 && <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>No audit records found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Overrides() {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>OVERRIDE PROTOCOLS</h1>
      <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.78rem', border:'1px solid var(--border-dim)', borderRadius:8 }}>
        No active override protocols.
      </div>
    </div>
  );
}
