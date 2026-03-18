// src/components/shared/Shell.jsx
// Main app shell — sidebar + topbar + AI drawer, shared across all roles
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ai as aiApi } from '../../services/api';
import { v4 as uuidv4 } from 'uuid';

const ROLE_LABELS = {
  ADMIN:           { label: 'System Admin',    color: '#ff4d6d' },
  FLEET_MANAGER:   { label: 'Fleet Manager',   color: '#00c9ff' },
  ANALYST:         { label: 'Analyst',         color: '#7ee8a2' },
  SENIOR_OPERATOR: { label: 'Senior Operator', color: '#ffb347' },
  OPERATOR:        { label: 'Operator',        color: '#00e5a0' },
};

const NAV_ITEMS = {
  ADMIN: [
    { id: 'overview',   icon: '⬡', label: 'System Overview' },
    { id: 'users',      icon: '◈', label: 'User Management' },
    { id: 'nodes',      icon: '⬢', label: 'Server Nodes' },
    { id: 'overrides',  icon: '⚠', label: 'Override Protocols' },
    { id: 'audit',      icon: '◉', label: 'Audit Log' },
  ],
  FLEET_MANAGER: [
    { id: 'map',        icon: '◎', label: 'Fleet Map' },
    { id: 'routes',     icon: '⇢', label: 'Route Approvals' },
    { id: 'profitability', icon: '◈', label: 'Profitability' },
    { id: 'vessels',    icon: '⬡', label: 'Vessel Registry' },
  ],
  ANALYST: [
    { id: 'financials', icon: '◈', label: 'Financial Models' },
    { id: 'drag',       icon: '⬢', label: 'Drag Efficiency' },
    { id: 'projections',icon: '◉', label: 'Projections' },
    { id: 'cases',      icon: '◎', label: 'Case Studies' },
  ],
  SENIOR_OPERATOR: [
    { id: 'fleet',      icon: '⬡', label: 'Fleet Overview' },
    { id: 'swarm',      icon: '⬢', label: 'Swarm Requests' },
    { id: 'routes',     icon: '⇢', label: 'Route Control' },
    { id: 'alerts',     icon: '⚠', label: 'Alert Centre' },
  ],
  OPERATOR: [
    { id: 'cockpit',    icon: '◎', label: 'Cockpit' },
    { id: 'compass',    icon: '⬡', label: 'Quantum Compass' },
    { id: 'lidar',      icon: '⬢', label: 'Eagle Eye LiDAR' },
    { id: 'skin',       icon: '◈', label: 'Smart Skin' },
  ],
};

export function Shell({ children, activePage, onNavigate, connected, lastUpdate, alertCount = 0 }) {
  const { user, logout }      = useAuth();
  const [aiOpen, setAiOpen]   = useState(false);
  const role = user?.role || 'OPERATOR';
  const meta = ROLE_LABELS[role] || ROLE_LABELS.OPERATOR;
  const navItems = NAV_ITEMS[role] || [];

  return (
    <div data-role={role} style={{ display:'flex', height:'100vh', background:'var(--bg-void)' }}>
      {/* ── Sidebar ─────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-deep)',
        borderRight: '1px solid var(--border-dim)',
        display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)' }}>
            SENTINEL
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.12em' }}>
            AERO-SEA PLATFORM v1.0
          </div>
        </div>

        {/* Role badge */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>
            Logged in as
          </div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.9rem', color:'var(--text-primary)' }}>
            {user?.fullName || user?.full_name}
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:5, padding:'2px 8px', borderRadius:3, background:'var(--accent-dim)', border:'1px solid var(--accent-border)' }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--accent-text)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 0', overflowY:'auto' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'10px 20px', background:'none', border:'none', cursor:'pointer',
                borderLeft: activePage===item.id ? '2px solid var(--accent)' : '2px solid transparent',
                backgroundColor: activePage===item.id ? 'var(--accent-dim)' : 'transparent',
                color: activePage===item.id ? 'var(--accent-text)' : 'var(--text-muted)',
                fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.82rem',
                letterSpacing:'0.06em', textTransform:'uppercase',
                transition:'all 0.15s',
              }}>
              <span style={{ fontSize:'1rem', opacity: activePage===item.id ? 1 : 0.5 }}>{item.icon}</span>
              <span style={{ flex:1, textAlign:'left' }}>{item.label}</span>
              {item.id === 'alerts' && alertCount > 0 && (
                <span style={{ background:'var(--status-red)', color:'white', borderRadius:10, padding:'1px 6px', fontSize:'0.6rem', fontFamily:'var(--font-mono)', fontWeight:700, minWidth:18, textAlign:'center' }}>
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Connection status */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border-dim)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div className={connected ? 'pulse-dot' : ''} style={{
              width:7, height:7, borderRadius:'50%',
              background: connected ? 'var(--status-green)' : 'var(--status-red)',
              flexShrink: 0,
            }}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color: connected ? 'var(--status-green)' : 'var(--status-red)' }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          {lastUpdate && (
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', marginTop:3 }}>
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* AI + Logout */}
        <div style={{ padding:'10px 14px 14px', display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={() => setAiOpen(true)} className="btn btn-ghost btn-sm" style={{ justifyContent:'center' }}>
            ⬡ Sentinel AI
          </button>
          <button onClick={logout} style={{
            background:'none', border:'1px solid var(--border-dim)', borderRadius:5,
            padding:'6px 0', color:'var(--text-muted)', fontFamily:'var(--font-display)',
            fontSize:'0.75rem', letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer',
          }}>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────── */}
      <main style={{ flex:1, overflow:'auto', position:'relative' }}>
        <div className="page-enter" style={{ minHeight:'100%' }}>
          {children}
        </div>
      </main>

      {/* ── AI Drawer ────────────────────────────── */}
      {aiOpen && <AIDrawer onClose={() => setAiOpen(false)} userRole={role} />}
    </div>
  );
}

// ─── AI Chat Drawer ──────────────────────────────────────────
function AIDrawer({ onClose, userRole }) {
  const [messages, setMessages] = useState([
    { role:'assistant', content:`SENTINEL AI online. I have access to live fleet data, financials, and telemetry. Ask me anything — "What are our fuel savings today?" or "How is the Shanghai-LA route performing?"` }
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [streaming, setStreaming] = useState('');
  const sessionId = useRef(uuidv4());
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, streaming]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(m => [...m, { role:'user', content: msg }]);
    setLoading(true);
    setStreaming('');

    try {
      let fullReply = '';
      await aiApi.streamChat(msg, sessionId.current, (token) => {
        fullReply += token;
        setStreaming(fullReply);
      });
      setMessages(m => [...m, { role:'assistant', content: fullReply }]);
    } catch (err) {
      setMessages(m => [...m, { role:'assistant', content:`⚠ ${err.message}` }]);
    } finally {
      setLoading(false);
      setStreaming('');
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(4,6,13,0.75)', backdropFilter:'blur(4px)',
      display:'flex', justifyContent:'flex-end',
    }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div data-role={userRole} style={{
        width: 420, height:'100%',
        background:'var(--bg-deep)',
        borderLeft:'1px solid var(--accent-border)',
        display:'flex', flexDirection:'column',
        boxShadow:'-20px 0 60px rgba(0,0,0,0.6)',
        animation:'slideInRight 0.3s var(--ease-snap)',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border-dim)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem', letterSpacing:'0.08em', color:'var(--accent)' }}>SENTINEL AI</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', marginTop:2 }}>LOCAL LLM · ZERO API KEYS · LIVE DATA</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
        </div>

        {/* Messages */}
        <div className="scroll-area" style={{ flex:1, padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: m.role==='user' ? 'flex-end' : 'flex-start' }}>
              <div className={m.role==='user' ? 'ai-bubble-user' : 'ai-bubble-assistant'}>
                {m.content}
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', marginTop:3, paddingInline:4 }}>
                {m.role==='user' ? 'YOU' : 'SENTINEL AI'}
              </div>
            </div>
          ))}
          {streaming && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
              <div className="ai-bubble-assistant">
                {streaming}<span className="ai-cursor"/>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Quick prompts */}
        <div style={{ padding:'0 16px 8px', display:'flex', gap:6, flexWrap:'wrap' }}>
          {["Fuel savings today?","Drag efficiency status","Shanghai-LA performance","Fleet alerts?"].map(q => (
            <button key={q} onClick={() => setInput(q)} style={{
              padding:'3px 9px', borderRadius:3, background:'var(--bg-raised)',
              border:'1px solid var(--border-dim)', color:'var(--text-muted)',
              fontFamily:'var(--font-mono)', fontSize:'0.65rem', cursor:'pointer',
              transition:'all 0.15s',
            }}>{q}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding:'12px 16px 16px', borderTop:'1px solid var(--border-dim)', display:'flex', gap:8 }}>
          <input className="input" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask about fleet, savings, telemetry..." disabled={loading}
            style={{ flex:1 }}
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn btn-primary btn-sm">
            {loading ? '...' : '⇢'}
          </button>
        </div>
      </div>
    </div>
  );
}

// CSS for drawer animation
const style = document.createElement('style');
style.textContent = `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`;
document.head.appendChild(style);
