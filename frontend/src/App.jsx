// src/App.jsx
import { useState, Component } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTelemetry } from './hooks/useTelemetry';
import { Shell } from './components/shared/Shell';
import Login from './components/shared/Login';
import OperatorDashboard from './components/operator/OperatorDashboard';
import AnalystDashboard from './components/analyst/AnalystDashboard';
import SeniorOperatorDashboard from './components/senior-operator/SeniorOperatorDashboard';
import { FleetManagerDashboard, AdminDashboard } from './components/fleet-manager/Dashboards';
import './styles/globals.css';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-void)', flexDirection:'column', gap:16, padding:40 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', color:'var(--status-red)', letterSpacing:'0.1em' }}>SYSTEM ERROR</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--text-muted)', maxWidth:500, textAlign:'center', lineHeight:1.6 }}>{this.state.error.message}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>RELOAD PLATFORM</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_PAGE = { ADMIN:'overview', FLEET_MANAGER:'map', ANALYST:'financials', SENIOR_OPERATOR:'fleet', OPERATOR:'cockpit' };

function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage]   = useState(null);
  const ws                = useTelemetry();

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-void)', flexDirection:'column', gap:12 }}>
        <svg width={48} height={48} viewBox="0 0 48 48">
          <polygon points="24,4 44,40 4,40" fill="none" stroke="#00e5a0" strokeWidth={1.5}
            style={{ animation:'spin 3s linear infinite', transformOrigin:'24px 24px' }}/>
          <circle cx={24} cy={24} r={5} fill="#00e5a0" opacity={0.8}/>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </svg>
        <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'1rem', letterSpacing:'0.15em', color:'#00e5a0' }}>INITIALISING SENTINEL</div>
        <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'0.65rem', color:'#4a6080', letterSpacing:'0.1em' }}>AERO-SEA PLATFORM v1.0</div>
      </div>
    );
  }

  if (!user) return <Login />;

  const role       = user.role;
  const activePage = page || DEFAULT_PAGE[role] || 'overview';
  const props      = { page: activePage, telemetry: ws.telemetry, kpis: ws.kpis };

  const dash = () => {
    switch (role) {
      case 'ADMIN':           return <AdminDashboard          {...props} />;
      case 'FLEET_MANAGER':   return <FleetManagerDashboard   {...props} />;
      case 'ANALYST':         return <AnalystDashboard        {...props} />;
      case 'SENIOR_OPERATOR': return <SeniorOperatorDashboard {...props} />;
      case 'OPERATOR':        return <OperatorDashboard       {...props} />;
      default: return <div style={{padding:40,color:'#4a6080',fontFamily:'monospace'}}>Unknown role: {role}</div>;
    }
  };

  return (
    <Shell activePage={activePage} onNavigate={setPage} connected={ws.connected} lastUpdate={ws.lastUpdate} alertCount={ws.alertCount}>
      {dash()}
    </Shell>
  );
}

export default function App() {
  return <ErrorBoundary><AuthProvider><AppInner /></AuthProvider></ErrorBoundary>;
}
