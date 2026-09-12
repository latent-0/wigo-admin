import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { hasPermission } from '../domain/roles';

const searchQuery = z.object({ q: z.string().min(1).max(100) });

/**
 * Global cross-entity search over riders, applications, and deposits. Each section is
 * only searched if the caller's role can read that entity — search never becomes a
 * side-channel around RBAC.
 */
export function searchRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { q } = parseQuery(searchQuery, req.query);
      const needle = q.toLowerCase();
      const role = req.auth!.role;

      const riders = hasPermission(role, 'rider:read')
        ? ctx.db.riders
            .filter((r) => r.name.toLowerCase().includes(needle) || r.phone.includes(needle))
            .map((r) => ({ type: 'rider' as const, id: r.id, label: r.name, sub: r.phone }))
        : [];

      const applications = hasPermission(role, 'application:read')
        ? ctx.db.applications
            .filter((a) => a.applicantName.toLowerCase().includes(needle))
            .map((a) => ({ type: 'application' as const, id: a.id, label: a.applicantName, sub: a.status }))
        : [];

      const deposits = hasPermission(role, 'payment:read')
        ? ctx.db.deposits
            .filter((d) => d.idempotencyKey.includes(needle) || (d.providerRef ?? '').toLowerCase().includes(needle))
            .map((d) => ({ type: 'deposit' as const, id: d.id, label: d.providerRef ?? d.idempotencyKey, sub: d.status }))
        : [];

      res.json({ results: [...riders, ...applications, ...deposits] });
    }),
  );

  return router;
}
