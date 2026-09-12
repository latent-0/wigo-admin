import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '../domain/roles';
import { hasPermission } from '../domain/roles';
import { forbidden, unauthorized } from '../lib/errors';

/**
 * RBAC enforcement at the route layer — the gap flagged 10 Sep and closed 11 Sep:
 * every admin route checks the JWT role, not just the UI. Must run after requireAuth.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(unauthorized());
    if (!hasPermission(req.auth.role, permission)) {
      return next(forbidden(`Role '${req.auth.role}' lacks '${permission}'`));
    }
    next();
  };
}
