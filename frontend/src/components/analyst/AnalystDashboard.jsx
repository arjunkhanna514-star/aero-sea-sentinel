// src/components/analyst/AnalystDashboard.jsx
// ANALYST: Financial projections, historical trends, drag efficiency charts
import { useState, useEffect } from 'react';
import { financials as finApi } from '../../services/api';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ComposedChart
} from 'recharts';

const fmt = (n) => n ? `€${(+n).toLocaleString('en-EU', {minimumFractionDigits:0, maximumFractionDigits:0})}` : '—';

// Generate 12-month projection data
const genProjection = () => Array.from({length:12}).map((_,i) => {
  const ship = 40000 + i*1200 + (Math.random()-0.4)*2000;
  const air  = 102000 + i*4000 + (Math.random()-0.4)*5000;
  return {
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    ship: Math.round(ship), aircraft: Math.round(air), total: Math.round(ship+air),
    target: 140000,
  };
});

const genDragHistory = () => Array.from({length:48}).map((_,i) => ({
  h: `${String(Math.floor(i/2)).padStart(2,'0')}:${i%2===0?'00':'30'}`,
  ship:     +(15.5 + Math.sin(i*0.3)*1.8 + Math.random()*0.6).toFixed(2),
  aircraft: +(17.2 + Math.cos(i*0.25)*2.1 + Math.random()*0.8).toFixed(2),
  target:   16.0,
}));

export default function AnalystDashboard({ page }) {
  const [savings,     setSavings]     = useState(null);
  const [projections, setProjections] = useState(genProjection());
  const [dragData,    setDragData]    = useState(genDragHistory());
  const [cases,       setCases]       = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([finApi.savings(), finApi.caseStudies()])
      .then(([s, c]) => { setSavings(s); setCases(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (page === 'drag')        return <DragEfficiency data={dragData} />;
  if (page === 'projections') return <Projections data={projections} />;
  if (page === 'cases')       return <CaseStudies cases={cases} />;

  return <FinancialOverview savings={savings} loading={loading} projections={projections} dragData={dragData} />;
}

function FinancialOverview({ savings, loading, projections, dragData }) {
  const targets = savings?.targets || {};

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.8rem', letterSpacing:'0.06em', color:'var(--text-primary)' }}>
          FINANCIAL ANALYSIS
        </h1>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>
          Fleet-wide savings · Drag efficiency · 12-month projections
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          { k:'Ship Savings (30d)',     v: fmt(savings?.total_ship_savings_eur),     target: fmt(targets.monthly_ship_target_eur),     c:'#00c9ff' },
          { k:'Aircraft Savings (30d)', v: fmt(savings?.total_aircraft_savings_eur), target: fmt(targets.monthly_aircraft_target_eur), c:'#7ee8a2' },
          { k:'Total Fleet Savings',    v: fmt(savings?.total_fuel_savings_eur),     target:'—',                                       c:'var(--accent)' },
          { k:'Shanghai–LA Route',      v: fmt(savings?.shanghai_la_savings_eur),    target: '€40,000/mo',                             c:'#ffb347' },
        ].map(m => (
          <div key={m.k} className="metric-card">
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{m.k}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.7rem', color:m.c, lineHeight:1 }}>
              {loading ? <div className="skeleton" style={{width:100,height:30,display:'inline-block'}}/> : m.v || '—'}
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)', marginTop:5 }}>Target: {m.target}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16, marginBottom:16 }}>
        <div className="chart-container">
          <div className="chart-title">12-MONTH SAVINGS PROJECTION</div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={projections}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="month" tick={{fill:'#4a6080', fontSize:10, fontFamily:'IBM Plex Mono'}}/>
              <YAxis tick={{fill:'#4a6080', fontSize:9, fontFamily:'IBM Plex Mono'}} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} width={55}/>
              <Tooltip contentStyle={{background:'#0b1120',border:'1px solid #1a2840',fontFamily:'IBM Plex Mono',fontSize:11}} formatter={v=>[`€${v.toLocaleString()}`,'']}/>
              <ReferenceLine y={140000} stroke="rgba(126,232,162,0.3)" strokeDasharray="4 2" label={{value:'TARGET',fill:'#7ee8a2',fontSize:9,fontFamily:'IBM Plex Mono'}}/>
              <Bar dataKey="ship" name="Ship" fill="rgba(0,201,255,0.6)" stackId="a"/>
              <Bar dataKey="aircraft" name="Aircraft" fill="rgba(126,232,162,0.7)" stackId="a" radius={[2,2,0,0]}/>
              <Legend wrapperStyle={{fontFamily:'IBM Plex Mono',fontSize:10}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">DRAG REDUCTION — LAST 24H</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dragData.slice(-24)}>
              <defs>
                <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00c9ff" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#00c9ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7ee8a2" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#7ee8a2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="h" hide/>
              <YAxis domain={[12,22]} tick={{fill:'#4a6080',fontSize:9,fontFamily:'IBM Plex Mono'}} width={35}/>
              <Tooltip contentStyle={{background:'#0b1120',border:'1px solid #1a2840',fontFamily:'IBM Plex Mono',fontSize:11}} formatter={v=>[v+'%','']}/>
              <Area type="monotone" dataKey="ship"     stroke="#00c9ff" fill="url(#ag1)" strokeWidth={1.5} dot={false} name="Ship"/>
              <Area type="monotone" dataKey="aircraft" stroke="#7ee8a2" fill="url(#ag2)" strokeWidth={1.5} dot={false} name="Aircraft"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Annual targets progress */}
      <div className="panel" style={{ padding:20 }}>
        <div className="chart-title">ANNUAL SAVINGS TARGETS</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {[
            { label:'Ship Fleet (€500k/vessel/year)',    current: 498200, target: 500000, color:'#00c9ff' },
            { label:'Aircraft Fleet (€1.2M/unit/year)', current: 1228800, target: 1200000, color:'#7ee8a2' },
          ].map(m => {
            const pct = Math.min((m.current/m.target)*100, 110);
            return (
              <div key={m.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-secondary)' }}>{m.label}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:m.color, fontWeight:600 }}>{(pct).toFixed(1)}%</span>
                </div>
                <div style={{ height:8, background:'var(--bg-void)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', width:`${Math.min(pct,100)}%`, background:m.color, borderRadius:4,
                    boxShadow:`0 0 10px ${m.color}55`, transition:'width 1s var(--ease-smooth)',
                  }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)' }}>€{m.current.toLocaleString()}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)' }}>Target: €{m.target.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DragEfficiency({ data }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>DRAG EFFICIENCY ANALYSIS</h1>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="chart-container" style={{ gridColumn:'1/-1' }}>
          <div className="chart-title">DRAG REDUCTION % — SHIP vs AIRCRAFT (48h)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="h" tick={{fill:'#4a6080',fontSize:9,fontFamily:'IBM Plex Mono'}} interval={7}/>
              <YAxis domain={[12,22]} tick={{fill:'#4a6080',fontSize:9,fontFamily:'IBM Plex Mono'}} width={35}/>
              <ReferenceLine y={16} stroke="rgba(255,176,32,0.4)" strokeDasharray="4 2"/>
              <Tooltip contentStyle={{background:'#0b1120',border:'1px solid #1a2840',fontFamily:'IBM Plex Mono',fontSize:11}} formatter={v=>[v+'%','']}/>
              <Line type="monotone" dataKey="ship" stroke="#00c9ff" strokeWidth={2} dot={false} name="Ship"/>
              <Line type="monotone" dataKey="aircraft" stroke="#7ee8a2" strokeWidth={2} dot={false} name="Aircraft"/>
              <Legend wrapperStyle={{fontFamily:'IBM Plex Mono',fontSize:10}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        {[
          { title:'SHIP AVG DRAG REDUCTION', v:'17.2%', sub:'MV Pacific Sentinel lead', c:'#00c9ff' },
          { title:'AIRCRAFT AVG DRAG REDUCTION', v:'18.4%', sub:'AS Horizon Eagle lead', c:'#7ee8a2' },
          { title:'MICRO-ADJUSTMENTS TODAY', v:'284,921', sub:'across all Smart Skin panels', c:'var(--accent)' },
          { title:'FUEL SAVED TODAY', v:'€6,240', sub:'fleet-wide via drag reduction', c:'#ffb347' },
        ].map(m => (
          <div key={m.title} className="metric-card">
            <div className="metric-label">{m.title}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'2rem', color:m.c, marginTop:6 }}>{m.v}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)', marginTop:4 }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Projections({ data }) {
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>12-MONTH PROJECTIONS</h1>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16 }}>
        <div className="chart-container">
          <div className="chart-title">CUMULATIVE FLEET SAVINGS FORECAST</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.map((d,i) => ({ ...d, cumulative: data.slice(0,i+1).reduce((s,x)=>s+x.total,0) }))}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7ee8a2" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#7ee8a2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="month" tick={{fill:'#4a6080',fontSize:10,fontFamily:'IBM Plex Mono'}}/>
              <YAxis tick={{fill:'#4a6080',fontSize:9,fontFamily:'IBM Plex Mono'}} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} width={60}/>
              <Tooltip contentStyle={{background:'#0b1120',border:'1px solid #1a2840',fontFamily:'IBM Plex Mono',fontSize:11}} formatter={v=>[`€${v.toLocaleString()}`,'']}/>
              <Area type="monotone" dataKey="cumulative" stroke="#7ee8a2" fill="url(#cg)" strokeWidth={2} dot={false} name="Cumulative"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="panel" style={{ padding:0, overflow:'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Month</th><th>Ship Savings</th><th>Aircraft Savings</th><th>Total</th><th>vs Target</th></tr></thead>
            <tbody>
              {data.map(r => (
                <tr key={r.month}>
                  <td style={{ color:'var(--text-primary)', fontWeight:600 }}>{r.month}</td>
                  <td style={{ color:'#00c9ff' }}>€{r.ship.toLocaleString()}</td>
                  <td style={{ color:'#7ee8a2' }}>€{r.aircraft.toLocaleString()}</td>
                  <td style={{ color:'var(--accent-text)', fontWeight:600 }}>€{r.total.toLocaleString()}</td>
                  <td>
                    <span style={{ color: r.total>=r.target ? 'var(--status-green)' : 'var(--status-amber)', fontFamily:'var(--font-mono)', fontSize:'0.75rem' }}>
                      {r.total>=r.target ? '▲' : '▼'} {Math.abs(((r.total-r.target)/r.target)*100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CaseStudies({ cases }) {
  const data = cases.length ? cases : [
    { title:'Shanghai → Los Angeles', vessel:'MV Shanghai Express', type:'SHIP', monthly_savings_eur:41250, annual_savings_eur:495000, target_eur:500000, drag_reduction_pct:17.2, fuel_saved_l_month:124000, co2_saved_kg_month:328960 },
    { title:'Intercontinental Cargo', vessel:'AS Horizon Eagle',    type:'AIRCRAFT', monthly_savings_eur:102400, annual_savings_eur:1228800, target_eur:1200000, drag_reduction_pct:18.4, fuel_saved_l_month:89600, co2_saved_kg_month:227680 },
  ];
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.6rem', letterSpacing:'0.06em', marginBottom:20 }}>CASE STUDIES</h1>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {data.map(c => (
          <div key={c.title} className="panel panel-accent" style={{ padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', letterSpacing:'0.05em', color:'var(--text-primary)' }}>{c.title}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)', marginTop:4 }}>{c.vessel}</div>
              </div>
              <div className={`badge badge-${c.type==='SHIP'?'active':'pending'}`}>{c.type}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                ['Monthly Savings', `€${c.monthly_savings_eur.toLocaleString()}`, 'var(--accent-text)'],
                ['Annual Savings',  `€${c.annual_savings_eur.toLocaleString()}`,  'var(--status-green)'],
                ['Drag Reduction',  c.drag_reduction_pct+'%',                     'var(--status-blue)'],
                ['CO₂ Saved/mo',   `${Math.round(c.co2_saved_kg_month/1000)}t`,  'var(--text-secondary)'],
              ].map(([k,v,col]) => (
                <div key={k} style={{ padding:'10px 12px', background:'var(--bg-raised)', borderRadius:5, border:'1px solid var(--border-dim)' }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', textTransform:'uppercase' }}>{k}</div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.2rem', color:col, marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-muted)' }}>Annual vs Target</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--status-green)' }}>
                  {((c.annual_savings_eur/c.target_eur)*100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height:5, background:'var(--bg-void)', borderRadius:3 }}>
                <div style={{ height:'100%', width:Math.min((c.annual_savings_eur/c.target_eur)*100,100)+'%', background:'var(--accent)', borderRadius:3, boxShadow:'0 0 8px var(--accent-glow)' }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
