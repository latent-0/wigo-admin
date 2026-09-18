import { useState } from 'react';
import { api } from '../api/client';
import type { NotificationRecord, TemplateDef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { AsyncBoundary, PageHeader, StatusBadge, formatDate } from '../components/ui';

export function NotificationsPage() {
  const { can } = useAuth();
  const templates = useAsync<{ items: TemplateDef[] }>(() => api.get('/notifications/templates'), []);
  const log = useAsync<{ items: NotificationRecord[] }>(() => api.get('/notifications'), []);

  const [to, setTo] = useState('+5215515590000');
  const [templateName, setTemplateName] = useState('application_approved');
  const [params, setParams] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = templates.data?.items.find((t) => t.name === templateName);

  const send = async () => {
    setError(null);
    setFlash(null);
    setBusy(true);
    try {
      const rec = await api.post<NotificationRecord>('/notifications/send', { to, templateName, params });
      setFlash(`Sent (status: ${rec.status}, attempts: ${rec.attempts})`);
      log.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="WhatsApp Business API messaging center (via NotificationsPort). Runs on the fake adapter until live credentials land."
      />

      {can('notification:send') && (
        <div className="panel">
          <h2 className="section-title">Send a template message</h2>
          <div className="send-form">
            <label className="field">
              <span>To (E.164)</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="field">
              <span>Template</span>
              <select
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  setParams({});
                }}
              >
                {templates.data?.items.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {selected?.params.map((p) => (
              <label className="field" key={p}>
                <span>{p}</span>
                <input value={params[p] ?? ''} onChange={(e) => setParams((prev) => ({ ...prev, [p]: e.target.value }))} />
              </label>
            ))}
            <button className="btn btn-primary" disabled={busy} onClick={send}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
          {selected && <p className="muted preview">Preview: {renderPreview(selected, params)}</p>}
          {flash && <div className="flash">{flash}</div>}
          {error && <div className="error-box">{error}</div>}
        </div>
      )}

      <h2 className="section-title">Recent messages</h2>
      <AsyncBoundary loading={log.loading} error={log.error}>
        <table className="data-table">
          <thead>
            <tr>
              <th>To</th>
              <th>Template</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Message ID</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {log.data?.items.map((n) => (
              <tr key={n.id}>
                <td className="mono">{n.to}</td>
                <td>{n.templateName}</td>
                <td>
                  <StatusBadge status={n.status} />
                  {n.lastError && <span className="muted"> · {n.lastError}</span>}
                </td>
                <td>{n.attempts}</td>
                <td className="mono">{n.providerMessageId ?? '—'}</td>
                <td>{formatDate(n.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </div>
  );
}

function renderPreview(t: TemplateDef, params: Record<string, string>): string {
  return t.body.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => params[k] || `{${k}}`);
}
