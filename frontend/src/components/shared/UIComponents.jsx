// src/components/shared/UIComponents.jsx
// Shared atomic components used across all 5 role dashboards

import { useState } from 'react';

// ─── MetricCard ───────────────────────────────────────────────
export function MetricCard({ label, value, unit, delta, deltaPositive, color, loading, warning, onClick }) {
  return (
    <div
      className="metric-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderColor: warning ? 'rgba(255,60,90,0.4)' : undefined,
        boxShadow: warning ? '0 0 16px rgba(255,60,90,0.15)' : undefined,
      }}
    >
      {loading ? (
        <div className="skeleton" style={{ height: 36, width: '70%', marginBottom: 8 }} />
      ) : (
        <div
          className="metric-value"
          style={{ color: color || 'var(--accent-text)', fontSize: '1.8rem' }}
        >
          {value}{unit && <span style={{ fontSize: '0.9rem', opacity: 0.7, marginLeft: 3 }}>{unit}</span>}
        </div>
      )}
      <div className="metric-label">{label}</div>
      {delta !== undefined && (
        <div
          className="metric-delta"
          style={{ color: deltaPositive ? 'var(--status-green)' : 'var(--status-red)', marginTop: 4 }}
        >
          {deltaPositive ? '▲' : '▼'} {delta}
        </div>
      )}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.06em' }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── LiveIndicator ────────────────────────────────────────────
export function LiveIndicator({ label = 'LIVE', active = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: active ? 'var(--status-green)' : 'var(--text-dim)',
        boxShadow: active ? '0 0 6px var(--status-green)' : 'none',
        animation: active ? 'none' : 'none',
        position: 'relative',
        flexShrink: 0,
      }}>
        {active && (
          <span style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            background: 'var(--status-green)', opacity: 0.3,
            animation: 'pulse-ring 2s ease-out infinite',
          }} />
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: active ? 'var(--status-green)' : 'var(--text-dim)', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  );
}

// ─── AlertBanner ──────────────────────────────────────────────
export function AlertBanner({ alerts = [], onAcknowledge }) {
  const critical = alerts.filter(a => a.severity === 'CRITICAL' && !a.is_acknowledged);
  if (critical.length === 0) return null;

  return (
    <div style={{
      margin: '0 0 16px',
      padding: '10px 16px',
      background: 'rgba(255,60,90,0.08)',
      border: '1px solid rgba(255,60,90,0.35)',
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-red)', flexShrink: 0, boxShadow: '0 0 8px var(--status-red)' }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--status-red)', letterSpacing: '0.06em' }}>
          {critical.length} CRITICAL ALERT{critical.length > 1 ? 'S' : ''}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 12 }}>
          {critical[0]?.title}
        </span>
      </div>
      {onAcknowledge && (
        <button
          onClick={() => onAcknowledge(critical[0]?.id)}
          className="btn btn-ghost btn-sm"
          style={{ borderColor: 'rgba(255,60,90,0.4)', color: 'var(--status-red)' }}
        >
          ACK
        </button>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────
export function Modal({ title, children, onClose, width = 480 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,6,13,0.8)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width, maxWidth: '100%', maxHeight: '90vh',
        background: 'var(--bg-panel)',
        border: '1px solid var(--accent-border)',
        borderRadius: 10,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'pageIn 0.25s var(--ease-snap)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.08em', color: 'var(--accent-text)' }}>
            {title}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div className="scroll-area" style={{ flex: 1, padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────
export function FormField({ label, children, error }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--status-red)', marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────
export function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input"
      style={{ cursor: 'pointer' }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────
export function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false }) {
  return (
    <Modal title={title} onClose={onCancel} width={400}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-sm"
          onClick={onConfirm}
          style={{ background: danger ? 'var(--status-red)' : 'var(--accent)', color: 'var(--bg-void)' }}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}

// ─── EmptyState ───────────────────────────────────────────────
export function EmptyState({ icon = '◈', title, subtitle }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', opacity: 0.6 }}>{subtitle}</div>
      )}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}>
      <circle cx={size/2} cy={size/2} r={size/2 - 2} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray={`${size} ${size * 3}`} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color, height = 4, label, showPct = false }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      {(label || showPct) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          {label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>}
          {showPct && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: color || 'var(--accent-text)' }}>{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div style={{ height, background: 'var(--bg-void)', borderRadius: height, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color || 'var(--accent)',
          borderRadius: height,
          boxShadow: `0 0 8px ${color || 'var(--accent-glow)'}55`,
          transition: 'width 0.8s var(--ease-smooth)',
        }} />
      </div>
    </div>
  );
}

// ─── Tooltip wrapper ──────────────────────────────────────────
export function Tip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-soft)',
          borderRadius: 4,
          padding: '4px 8px',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          {text}
        </div>
      )}
    </div>
  );
}
