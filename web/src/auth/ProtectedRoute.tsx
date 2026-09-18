import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Permission } from './permissions';

/** Gate a route on authentication and (optionally) a permission. */
export function ProtectedRoute({ permission, children }: { permission?: Permission; children: ReactNode }) {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) {
    return (
      <div className="empty">
        <h2>Not authorized</h2>
        <p>Your role ({user.role}) does not have access to this section.</p>
      </div>
    );
  }
  return <>{children}</>;
}
