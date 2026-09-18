import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { AdminUser, Role } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../auth/AuthContext';
import { AsyncBoundary, PageHeader, StatusBadge, formatDate } from '../components/ui';

const ROLES: Role[] = ['super_admin', 'admin', 'ops', 'finance', 'compliance', 'support', 'read_only'];

export function AdminUsersPage() {
  const { can, user } = useAuth();
  const { data, error, loading, reload } = useAsync<{ items: AdminUser[] }>(() => api.get('/admin-users'), []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+52155');
  const [role, setRole] = useState<Role>('support');
  const [flash, setFlash] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invite = async () => {
    setFormError(null);
    setFlash(null);
    try {
      await api.post('/admin-users', { name, phone, role });
      setFlash(`Invited ${name}`);
      setName('');
      setPhone('+52155');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Invite failed');
    }
  };

  const toggleActive = async (u: AdminUser) => {
    await api.patch(`/admin-users/${u.id}`, { active: !u.active });
    reload();
  };

  const changeRole = async (u: AdminUser, newRole: Role) => {
    await api.patch(`/admin-users/${u.id}`, { role: newRole });
    reload();
  };

  return (
    <div>
      <PageHeader title="Admin Users" subtitle="Invite, deactivate, and assign roles across the 7-role model." />

      {can('admin_user:write') && (
        <div className="panel">
          <h2 className="section-title">Invite an admin</h2>
          <div className="send-form">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Phone (E.164)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" onClick={invite} disabled={!name || !phone}>
              Send invite
            </button>
          </div>
          {flash && <div className="flash">{flash}</div>}
          {formError && <div className="error-box">{formError}</div>}
        </div>
      )}

      <AsyncBoundary loading={loading} error={error}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Active</th>
              <th>Last login</th>
              {can('admin_user:write') && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="mono">{u.phone}</td>
                <td>
                  {can('admin_user:write') && u.id !== user?.id ? (
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    u.role
                  )}
                </td>
                <td>
                  <StatusBadge status={u.active ? 'active' : 'suspended'} />
                </td>
                <td>{formatDate(u.lastLoginAt)}</td>
                {can('admin_user:write') && (
                  <td>
                    {u.id !== user?.id && (
                      <button className="btn btn-sm" onClick={() => toggleActive(u)}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </div>
  );
}
