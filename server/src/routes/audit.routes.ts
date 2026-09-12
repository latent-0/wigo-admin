import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { parseQuery } from '../middleware/validate';
import { queryAudit } from '../services/audit.service';

const auditQuery = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export function auditRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requirePermission('audit:read'),
    asyncHandler(async (req, res) => {
      const q = parseQuery(auditQuery, req.query);
      const rows = queryAudit(ctx.db, { actorId: q.actorId, action: q.action, from: q.from, to: q.to });
      res.json({ items: rows.slice(0, q.limit), total: rows.length });
    }),
  );

  return router;
}
