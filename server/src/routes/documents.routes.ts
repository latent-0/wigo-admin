import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { pathParam } from '../lib/params';
import { notFound, badRequest } from '../lib/errors';
import { recordAudit } from '../lib/audit';
import { newId, nowIso } from '../lib/ids';
import type { DocumentRecord } from '../domain/types';
import { REJECT_REASON_CODES } from '../domain/types';

const uploadBody = z.object({
  riderId: z.string().min(1),
  kind: z.enum(['id_front', 'id_back', 'license', 'selfie']),
  storageRef: z.string().min(1), // reference from the upload pipeline, not a raw blob
});

const rejectBody = z.object({
  reasonCode: z.enum(REJECT_REASON_CODES),
  reasonNote: z.string().max(500).optional(),
});

export function documentsRoutes(ctx: AppContext): Router {
  const router = Router();

  // Document Review Queue — pending first.
  router.get(
    '/',
    requireAuth,
    requirePermission('document:read'),
    asyncHandler(async (req, res) => {
      const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const rows = ctx.db.documents.filter((d) => d.status === status);
      res.json({ items: rows, total: rows.length });
    }),
  );

  // Wired to the upload pipeline: stores the returned storage reference, never a blob.
  router.post(
    '/upload',
    requireAuth,
    requirePermission('document:review'),
    validateBody(uploadBody),
    asyncHandler(async (req, res) => {
      const rider = ctx.db.riders.get(req.body.riderId);
      if (!rider) throw notFound('Rider not found');
      const now = nowIso();
      const doc: DocumentRecord = {
        id: newId('doc'),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        riderId: req.body.riderId,
        kind: req.body.kind,
        storageRef: req.body.storageRef,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reasonCode: null,
        reasonNote: null,
      };
      ctx.db.documents.insert(doc);
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'document.upload',
        target: doc.id,
        meta: { riderId: doc.riderId, kind: doc.kind },
      });
      res.status(201).json(doc);
    }),
  );

  router.post(
    '/:id/approve',
    requireAuth,
    requirePermission('document:review'),
    asyncHandler(async (req, res) => {
      const doc = ctx.db.documents.get(pathParam(req, 'id'));
      if (!doc) throw notFound('Document not found');
      if (doc.status !== 'pending') throw badRequest('Document already reviewed');
      const updated = ctx.db.documents.update(doc.id, {
        status: 'approved',
        reviewedBy: req.auth!.userId,
        reviewedAt: nowIso(),
        reasonCode: null,
        reasonNote: null,
      });
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'document.approve',
        target: doc.id,
      });
      res.json(updated);
    }),
  );

  // Reject requires a reason code (approve/reject with reason codes, 11 Sep).
  router.post(
    '/:id/reject',
    requireAuth,
    requirePermission('document:review'),
    validateBody(rejectBody),
    asyncHandler(async (req, res) => {
      const doc = ctx.db.documents.get(pathParam(req, 'id'));
      if (!doc) throw notFound('Document not found');
      if (doc.status !== 'pending') throw badRequest('Document already reviewed');
      const updated = ctx.db.documents.update(doc.id, {
        status: 'rejected',
        reviewedBy: req.auth!.userId,
        reviewedAt: nowIso(),
        reasonCode: req.body.reasonCode,
        reasonNote: req.body.reasonNote ?? null,
      });
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'document.reject',
        target: doc.id,
        meta: { reasonCode: req.body.reasonCode },
      });
      res.json(updated);
    }),
  );

  return router;
}
