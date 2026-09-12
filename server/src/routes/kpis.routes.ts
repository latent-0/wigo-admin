import { Router } from 'express';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { computeKpis } from '../services/kpi.service';

export function kpisRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get(
    '/',
    requireAuth,
    requirePermission('kpi:read'),
    asyncHandler(async (_req, res) => {
      res.json(computeKpis(ctx.db));
    }),
  );
  return router;
}
