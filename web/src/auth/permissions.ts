import type { Role } from '../api/types';

// Client-side mirror of the server permission matrix. This only drives what the UI
// SHOWS — the server independently enforces RBAC on every route, so hiding a control
// here is never the security boundary.

export type Permission =
  | 'kpi:read'
  | 'rider:read'
  | 'rider:write'
  | 'application:read'
  | 'application:write'
  | 'payment:read'
  | 'payment:write'
  | 'document:read'
  | 'document:review'
  | 'notification:read'
  | 'notification:send'
  | 'audit:read'
  | 'admin_user:read'
  | 'admin_user:write'
  | 'experiment:read';

const ALL: Permission[] = [
  'kpi:read',
  'rider:read',
  'rider:write',
  'application:read',
  'application:write',
  'payment:read',
  'payment:write',
  'document:read',
  'document:review',
  'notification:read',
  'notification:send',
  'audit:read',
  'admin_user:read',
  'admin_user:write',
  'experiment:read',
];

const READ_ONLY = ALL.filter((p) => p.endsWith(':read'));

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  admin: ALL,
  ops: [
    'kpi:read',
    'rider:read',
    'rider:write',
    'application:read',
    'application:write',
    'notification:read',
    'notification:send',
    'experiment:read',
  ],
  finance: ['kpi:read', 'payment:read', 'payment:write', 'rider:read', 'audit:read', 'experiment:read'],
  compliance: [
    'kpi:read',
    'document:read',
    'document:review',
    'rider:read',
    'application:read',
    'audit:read',
    'experiment:read',
  ],
  support: ['kpi:read', 'rider:read', 'application:read', 'document:read', 'notification:read', 'experiment:read'],
  read_only: READ_ONLY,
};
