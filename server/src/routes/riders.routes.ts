import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, parseQuery } from '../middleware/validate';
import { notFound } from '../lib/errors';
import { pathParam } from '../lib/params';
import { recordAudit } from '../lib/audit';

const listQuery = z.object({
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  city: z.string().optional(),
  q: z.string().optional(),
});

const patchBody = z.object({ status: z.enum(['active', 'suspended', 'pending']) });

export function ridersRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requirePermission('rider:read'),
    asyncHandler(async (req, res) => {
      const { status, city, q } = parseQuery(listQuery, req.query);
      let rows = ctx.db.riders.all();
      if (status) rows = rows.filter((r) => r.status === status);
      if (city) rows = rows.filter((r) => r.city.toLowerCase() === city.toLowerCase());
      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || r.phone.includes(needle));
      }
      res.json({ items: rows, total: rows.length });
    }),
  );

  router.get(
    '/:id',
    requireAuth,
    requirePermission('rider:read'),
    asyncHandler(async (req, res) => {
      const rider = ctx.db.riders.get(pathParam(req, 'id'));
      if (!rider) throw notFound('Rider not found');
      res.json(rider);
    }),
  );

  router.patch(
    '/:id',
    requireAuth,
    requirePermission('rider:write'),
    validateBody(patchBody),
    asyncHandler(async (req, res) => {
      const rider = ctx.db.riders.get(pathParam(req, 'id'));
      if (!rider) throw notFound('Rider not found');
      const updated = ctx.db.riders.update(rider.id, { status: req.body.status });
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'rider.status_change',
        target: rider.id,
        meta: { from: rider.status, to: req.body.status },
      });
      res.json(updated);
    }),
  );

  return router;
}
