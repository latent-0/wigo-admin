import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { assignAll } from '../experiments/assign';
import { EXPERIMENTS } from '../experiments/config';
import { recordAudit } from '../lib/audit';
import { badRequest } from '../lib/errors';

const trackBody = z.object({
  experiment: z.string().min(1),
  variant: z.string().min(1),
  event: z.string().min(1),
});

export function experimentsRoutes(ctx: AppContext): Router {
  const router = Router();

  // Deterministic per-user assignment across every enabled experiment.
  router.get(
    '/me',
    requireAuth,
    requirePermission('experiment:read'),
    asyncHandler(async (req, res) => {
      res.json({ assignments: assignAll(req.auth!.userId) });
    }),
  );

  // Record an experiment exposure/conversion event (audit log is the sink for the pilot).
  router.post(
    '/track',
    requireAuth,
    requirePermission('experiment:read'),
    validateBody(trackBody),
    asyncHandler(async (req, res) => {
      if (!EXPERIMENTS[req.body.experiment]) throw badRequest('Unknown experiment');
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'experiment.track',
        target: req.body.experiment,
        meta: { variant: req.body.variant, event: req.body.event },
      });
      res.status(202).json({ ok: true });
    }),
  );

  return router;
}
