import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../domain/roles';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

export interface AuthContext {
  userId: string;
  role: Role;
}

// Augment Express' Request with the authenticated context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      rawBody?: Buffer;
    }
  }
}

/**
 * Require a valid access token. Attaches req.auth. The role comes from the token claim,
 * which is carried through refresh (11 Sep fix) so a refreshed session keeps its role.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Missing bearer token'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = verifyAccessToken(token);
    req.auth = { userId: claims.sub, role: claims.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}
