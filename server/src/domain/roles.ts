/**
 * The 7-role model referenced in the 11 Sep report ("invite, deactivate, and assign
 * roles across the 7-role model"). RBAC is enforced on every route by JWT role claim,
 * not just hidden in the UI (the gap flagged 10 Sep and closed 11 Sep).
 */
export const ROLES = [
  'super_admin',
  'admin',
  'ops',
  'finance',
  'compliance',
  'support',
  'read_only',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Permissions are `resource:action`. Route guards check these against the caller's role.
 * `support` is read-only on Document Review until told otherwise — the open question
 * from the 11 Sep report, defaulted to read-only.
 */
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

const READ_ONLY: Permission[] = ALL.filter((p) => p.endsWith(':read'));

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
  // Support is read-only on Document Review per the 11 Sep default.
  support: ['kpi:read', 'rider:read', 'application:read', 'document:read', 'notification:read', 'experiment:read'],
  read_only: READ_ONLY,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
