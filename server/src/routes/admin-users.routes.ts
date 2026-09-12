import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { pathParam } from '../lib/params';
import { notFound, conflict, badRequest } from '../lib/errors';
import { recordAudit } from '../lib/audit';
import { newId, nowIso } from '../lib/ids';
import { hashPassword } from '../lib/password';
import { ROLES } from '../domain/roles';
import type { AdminUser } from '../domain/types';
import { randomBytes } from 'node:crypto';

/** Strip the password hash before serializing an admin user to the client. */
function publicUser(u: AdminUser) {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
}

const inviteBody = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'phone must be E.164'),
  email: z.string().email().optional(),
  role: z.enum(ROLES),
});

const patchBody = z
  .object({
    role: z.enum(ROLES).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.active !== undefined, 'Nothing to update');

export function adminUsersRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requirePermission('admin_user:read'),
    asyncHandler(async (_req, res) => {
      res.json({ items: ctx.db.adminUsers.all().map(publicUser) });
    }),
  );

  // Invite: creates an inactive-password account; the invitee signs in via WhatsApp-OTP.
  router.post(
    '/',
    requireAuth,
    requirePermission('admin_user:write'),
    validateBody(inviteBody),
    asyncHandler(async (req, res) => {
      if (ctx.db.adminUsers.find((u) => u.phone === req.body.phone)) {
        throw conflict('An admin with this phone already exists');
      }
      const now = nowIso();
      // Random unusable password; login is via OTP until the user sets one.
      const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
      const user: AdminUser = {
        id: newId('usr'),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email ?? null,
        role: req.body.role,
        passwordHash,
        active: true,
        lastLoginAt: null,
      };
      ctx.db.adminUsers.insert(user);
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'admin_user.invite',
        target: user.id,
        meta: { role: user.role },
      });
      res.status(201).json(publicUser(user));
    }),
  );

  router.patch(
    '/:id',
    requireAuth,
    requirePermission('admin_user:write'),
    validateBody(patchBody),
    asyncHandler(async (req, res) => {
      const id = pathParam(req, 'id');
      const user = ctx.db.adminUsers.get(id);
      if (!user) throw notFound('Admin user not found');
      // Guard: an admin cannot deactivate or demote their own account.
      if (id === req.auth!.userId && req.body.active === false) {
        throw badRequest('You cannot deactivate your own account');
      }
      const patch: Partial<AdminUser> = {};
      if (req.body.role !== undefined) patch.role = req.body.role;
      if (req.body.active !== undefined) patch.active = req.body.active;
      const updated = ctx.db.adminUsers.update(user.id, patch);
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'admin_user.update',
        target: user.id,
        meta: patch,
      });
      res.json(publicUser(updated));
    }),
  );

  return router;
}
