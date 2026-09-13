import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, parseQuery } from '../middleware/validate';
import { pathParam } from '../lib/params';
import { notFound, badRequest } from '../lib/errors';
import { recordAudit } from '../lib/audit';
import { sortApplications } from '../services/applications.service';

const listQuery = z.object({
  status: z.enum(['submitted', 'in_review', 'approved', 'rejected']).optional(),
  kind: z.enum(['buy', 'rent']).optional(),
  sort: z.enum(['createdAt', 'pickupAt']).default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

const decisionBody = z.object({
  decision: z.enum(['approve', 'reject', 'in_review']),
  note: z.string().max(500).optional(),
});

const STATUS_FOR_DECISION = {
  approve: 'approved',
  reject: 'rejected',
  in_review: 'in_review',
} as const;

export function applicationsRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requirePermission('application:read'),
    asyncHandler(async (req, res) => {
      const { status, kind, sort, dir } = parseQuery(listQuery, req.query);
      let rows = ctx.db.applications.all();
      if (status) rows = rows.filter((a) => a.status === status);
      if (kind) rows = rows.filter((a) => a.kind === kind);
      rows = sortApplications(rows, sort, dir); // null-safe (13 Sep fix)
      res.json({ items: rows, total: rows.length });
    }),
  );

  router.get(
    '/:id',
    requireAuth,
    requirePermission('application:read'),
    asyncHandler(async (req, res) => {
      const app = ctx.db.applications.get(pathParam(req, 'id'));
      if (!app) throw notFound('Application not found');
      res.json(app);
    }),
  );

  router.post(
    '/:id/decision',
    requireAuth,
    requirePermission('application:write'),
    validateBody(decisionBody),
    asyncHandler(async (req, res) => {
      const app = ctx.db.applications.get(pathParam(req, 'id'));
      if (!app) throw notFound('Application not found');
      const nextStatus = STATUS_FOR_DECISION[req.body.decision as keyof typeof STATUS_FOR_DECISION];
      if (app.status === 'approved' || app.status === 'rejected') {
        throw badRequest('Application already has a final decision');
      }
      const updated = ctx.db.applications.update(app.id, { status: nextStatus });
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'application.decision',
        target: app.id,
        meta: { decision: req.body.decision, note: req.body.note ?? null },
      });
      res.json(updated);
    }),
  );

  return router;
}
