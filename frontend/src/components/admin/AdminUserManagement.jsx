// src/components/admin/AdminUserManagement.jsx
// Full user management: list, create, edit role, reset password, delete
import { useState } from 'react';
import { admin as adminApi } from '../../services/api';
import { Modal, FormField, Select, ConfirmDialog, EmptyState, Spinner } from '../shared/UIComponents';

const ROLE_COLORS = {
  ADMIN:           '#ff4d6d',
  FLEET_MANAGER:   '#00c9ff',
  ANALYST:         '#7ee8a2',
  SENIOR_OPERATOR: '#ffb347',
  OPERATOR:        '#00e5a0',
};
const ROLE_OPTIONS = [
  { value: 'ADMIN',           label: 'Admin' },
  { value: 'FLEET_MANAGER',   label: 'Fleet Manager' },
  { value: 'ANALYST',         label: 'Analyst' },
  { value: 'SENIOR_OPERATOR', label: 'Senior Operator' },
  { value: 'OPERATOR',        label: 'Operator' },
];

export default function AdminUserManagement({ users, setUsers }) {
  const [showCreate,   setShowCreate]   = useState(false);
  const [editUser,     setEditUser]     = useState(null);
  const [resetUser,    setResetUser]    = useState(null);
  const [deleteUser,   setDeleteUser]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [filterRole,   setFilterRole]   = useState('');

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole   = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleCreate = async (data) => {
    setLoading(true); setError('');
    try {
      const newUser = await adminApi.createUser(data);
      setUsers(prev => [...prev, newUser]);
      setShowCreate(false);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleEdit = async (id, data) => {
    setLoading(true); setError('');
    try {
      const updated = await adminApi.updateUser(id, data);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
      setEditUser(null);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleResetPw = async (id, password) => {
    setLoading(true); setError('');
    try {
      await adminApi.resetPw(id, password);
      setResetUser(null);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    setLoading(true); setError('');
    try {
      await adminApi.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      setDeleteUser(null);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem', letterSpacing: '0.06em' }}>USER MANAGEMENT</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {users.length} total · {users.filter(u => u.is_active).length} active
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select
          className="input"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.full_name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                <td>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                    color: ROLE_COLORS[u.role] || 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    ● {u.role}
                  </span>
                </td>
                <td>
                  <div className={`badge badge-${u.is_active ? 'active' : 'idle'}`}>
                    {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(u)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setResetUser(u)} style={{ color: 'var(--status-amber)' }}>Reset PW</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteUser(u)} style={{ color: 'var(--status-red)', borderColor: 'rgba(255,60,90,0.3)' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6}><EmptyState icon="◈" title="No users found" subtitle="Try adjusting your search or filter" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <UserFormModal
          title="CREATE USER"
          onSubmit={handleCreate}
          onClose={() => { setShowCreate(false); setError(''); }}
          loading={loading}
          error={error}
          showPassword
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <UserFormModal
          title="EDIT USER"
          initial={editUser}
          onSubmit={(data) => handleEdit(editUser.id, data)}
          onClose={() => { setEditUser(null); setError(''); }}
          loading={loading}
          error={error}
        />
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onSubmit={(pw) => handleResetPw(resetUser.id, pw)}
          onClose={() => { setResetUser(null); setError(''); }}
          loading={loading}
          error={error}
        />
      )}

      {/* Delete Confirm */}
      {deleteUser && (
        <ConfirmDialog
          title="DELETE USER"
          message={`Permanently delete ${deleteUser.full_name} (${deleteUser.email})? All sessions will be invalidated. This cannot be undone.`}
          onConfirm={() => handleDelete(deleteUser.id)}
          onCancel={() => setDeleteUser(null)}
          danger
        />
      )}
    </div>
  );
}

function UserFormModal({ title, initial = {}, onSubmit, onClose, loading, error, showPassword }) {
  const [form, setForm] = useState({
    email:     initial.email     || '',
    full_name: initial.full_name || '',
    role:      initial.role      || 'OPERATOR',
    is_active: initial.is_active !== undefined ? initial.is_active : true,
    password:  '',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    const data = { ...form };
    if (!showPassword) delete data.password;
    onSubmit(data);
  };

  return (
    <Modal title={title} onClose={onClose} width={440}>
      <FormField label="Full Name">
        <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="John Smith" />
      </FormField>
      <FormField label="Email">
        <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@sentinel.io" />
      </FormField>
      {showPassword && (
        <FormField label="Password (min 10 chars)">
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••••" />
        </FormField>
      )}
      <FormField label="Role">
        <Select
          value={form.role}
          onChange={v => set('role', v)}
          options={ROLE_OPTIONS}
        />
      </FormField>
      {!showPassword && (
        <FormField label="Status">
          <Select
            value={form.is_active ? 'true' : 'false'}
            onChange={v => set('is_active', v === 'true')}
            options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
          />
        </FormField>
      )}
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,60,90,0.08)', border: '1px solid rgba(255,60,90,0.25)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--status-red)', marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : title.includes('CREATE') ? 'Create User' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onSubmit, onClose, loading, error }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const mismatch = confirm && password !== confirm;

  return (
    <Modal title={`RESET PASSWORD — ${user.full_name}`} onClose={onClose} width={400}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        All existing sessions for this user will be invalidated.
      </div>
      <FormField label="New Password (min 10 chars)">
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" />
      </FormField>
      <FormField label="Confirm Password" error={mismatch ? 'Passwords do not match' : undefined}>
        <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••••" />
      </FormField>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,60,90,0.08)', border: '1px solid rgba(255,60,90,0.25)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--status-red)', marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-sm"
          style={{ background: 'var(--status-amber)', color: 'var(--bg-void)' }}
          onClick={() => onSubmit(password)}
          disabled={loading || password.length < 10 || mismatch}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </Modal>
  );
}
